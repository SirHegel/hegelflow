import bcrypt from "bcryptjs";

import { db } from "@/lib/db";
import {
  OWNER_ACCESS,
  recordActivity,
  requireWorkspaceAccess,
} from "@/lib/domain/activity";
import type { ProfileMutationResult } from "@/lib/domain/boards";
import {
  createAccountForProfileSchema,
  createProfileWithAccountSchema,
  DomainError,
  parseDomainInput,
  rethrowDatabaseError,
  slugify,
  type CreateAccountForProfileInput,
  type CreateProfileWithAccountInput,
} from "@/lib/domain/validators";
import type { AccessLevel, WorkspaceContext } from "@/lib/types";

const BCRYPT_COST = 12;

export type AccountMutationResult = {
  id: string;
  username: string;
  status: "ACTIVE";
};

export type ProfileAccountMutationResult = {
  profile: ProfileMutationResult;
  account: AccountMutationResult;
};

type DatabaseErrorLike = {
  code?: unknown;
  constraint_name?: unknown;
};

function rethrowAccountDatabaseError(error: unknown): never {
  if (error instanceof DomainError) throw error;

  const databaseError = error as DatabaseErrorLike;
  if (databaseError?.code === "23505") {
    const constraint = String(databaseError.constraint_name ?? "");
    if (
      constraint === "users_username_lower_unique"
      || constraint === "users_email_lower_unique"
    ) {
      throw new DomainError(
        409,
        "ACCOUNT_IDENTIFIER_CONFLICT",
        "El nombre de usuario o correo ya está en uso.",
      );
    }
    if (
      constraint === "memberships_workspace_id_profile_slug_key"
      || constraint === "memberships_workspace_user_unique"
    ) {
      throw new DomainError(
        409,
        "PROFILE_CONFLICT",
        "Ya existe un perfil con ese identificador o cuenta.",
      );
    }
  }

  rethrowDatabaseError(
    error,
    "ACCOUNT_PROFILE_CONFLICT",
    "No fue posible crear la cuenta porque entra en conflicto con otro perfil.",
  );
}

export async function createProfileWithAccount(
  context: WorkspaceContext,
  rawInput: CreateProfileWithAccountInput,
): Promise<ProfileAccountMutationResult> {
  const input = parseDomainInput(createProfileWithAccountSchema, rawInput);
  if (context.accessLevel !== "OWNER") {
    throw new DomainError(403, "FORBIDDEN", "Su perfil no tiene permiso para crear cuentas.");
  }
  const profileSlug = input.profileSlug ?? slugify(input.fullName);
  const passwordHash = await bcrypt.hash(input.account.password, BCRYPT_COST);
  const sql = db();

  try {
    return await sql.begin(async (transaction) => {
      const [workspace] = await transaction<{ id: string }[]>`
        SELECT id
        FROM workspaces
        WHERE id = ${context.workspaceId}
        FOR NO KEY UPDATE
      `;
      if (!workspace) {
        throw new DomainError(404, "WORKSPACE_NOT_FOUND", "El espacio de trabajo no existe.");
      }

      await requireWorkspaceAccess(transaction, context, OWNER_ACCESS);

      const [account] = await transaction<AccountMutationResult[]>`
        INSERT INTO users (
          username,
          display_name,
          email,
          password_hash,
          status,
          avatar_color
        ) VALUES (
          ${input.account.username},
          ${input.fullName},
          ${input.email},
          ${passwordHash},
          'ACTIVE',
          ${input.avatarColor}
        )
        RETURNING id, username, status
      `;
      if (!account) {
        throw new DomainError(500, "ACCOUNT_CREATE_FAILED", "No fue posible crear la cuenta.");
      }

      const [profile] = await transaction<ProfileMutationResult[]>`
        INSERT INTO memberships (
          workspace_id,
          user_id,
          profile_slug,
          full_name,
          email,
          work_role,
          access_level,
          status,
          avatar_color,
          capacity_points
        ) VALUES (
          ${context.workspaceId},
          ${account.id},
          ${profileSlug},
          ${input.fullName},
          ${input.email},
          ${input.workRole},
          ${input.accessLevel},
          ${input.status},
          ${input.avatarColor},
          ${input.capacityPoints}
        )
        RETURNING
          id,
          workspace_id AS "workspaceId",
          user_id AS "userId",
          profile_slug AS "profileSlug",
          full_name AS "fullName",
          email,
          work_role AS "workRole",
          access_level AS "accessLevel",
          status,
          avatar_color AS "avatarColor",
          capacity_points AS "capacityPoints",
          updated_at::text AS "updatedAt"
      `;
      if (!profile) {
        throw new DomainError(500, "PROFILE_CREATE_FAILED", "No fue posible crear el perfil.");
      }

      await recordActivity(transaction, context, {
        boardId: null,
        entityType: "membership",
        entityId: profile.id,
        action: "account.created",
        summary: `Se creó una cuenta para «${profile.fullName}».`,
        metadata: {
          accessLevel: profile.accessLevel,
          status: profile.status,
          linkedAccount: true,
        },
      });

      return { profile, account };
    });
  } catch (error) {
    rethrowAccountDatabaseError(error);
  }
}

export async function createAccountForProfile(
  context: WorkspaceContext,
  rawInput: CreateAccountForProfileInput,
): Promise<ProfileAccountMutationResult> {
  const input = parseDomainInput(createAccountForProfileSchema, rawInput);
  if (context.accessLevel !== "OWNER") {
    throw new DomainError(403, "FORBIDDEN", "Su perfil no tiene permiso para crear cuentas.");
  }
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
  const sql = db();

  try {
    return await sql.begin(async (transaction) => {
      const [workspace] = await transaction<{ id: string }[]>`
        SELECT id
        FROM workspaces
        WHERE id = ${context.workspaceId}
        FOR NO KEY UPDATE
      `;
      if (!workspace) {
        throw new DomainError(404, "WORKSPACE_NOT_FOUND", "El espacio de trabajo no existe.");
      }

      await requireWorkspaceAccess(transaction, context, OWNER_ACCESS);

      const [current] = await transaction<{
        id: string;
        fullName: string;
        email: string | null;
        accessLevel: AccessLevel;
        status: "ACTIVE" | "INVITED" | "DISABLED";
        avatarColor: string;
      }[]>`
        SELECT
          id,
          full_name AS "fullName",
          email,
          access_level AS "accessLevel",
          status,
          avatar_color AS "avatarColor"
        FROM memberships
        WHERE id = ${input.membershipId}
          AND workspace_id = ${context.workspaceId}
          AND user_id IS NULL
        FOR UPDATE
      `;
      if (!current) {
        throw new DomainError(
          409,
          "PROFILE_ACCOUNT_UNAVAILABLE",
          "El perfil no existe o ya tiene una cuenta vinculada.",
        );
      }
      if (current.accessLevel === "OWNER") {
        throw new DomainError(
          403,
          "OWNER_ACCOUNT_CREATE_DENIED",
          "No se puede crear otra cuenta de propietario desde este flujo.",
        );
      }
      if (current.status !== "ACTIVE") {
        throw new DomainError(
          409,
          "PROFILE_INACTIVE",
          "Activa el perfil antes de crear sus credenciales.",
        );
      }

      const [account] = await transaction<AccountMutationResult[]>`
        INSERT INTO users (
          username,
          display_name,
          email,
          password_hash,
          status,
          avatar_color
        ) VALUES (
          ${input.username},
          ${current.fullName},
          ${current.email},
          ${passwordHash},
          'ACTIVE',
          ${current.avatarColor}
        )
        RETURNING id, username, status
      `;
      if (!account) {
        throw new DomainError(500, "ACCOUNT_CREATE_FAILED", "No fue posible crear la cuenta.");
      }

      const [profile] = await transaction<ProfileMutationResult[]>`
        UPDATE memberships
        SET user_id = ${account.id}
        WHERE id = ${current.id}
          AND workspace_id = ${context.workspaceId}
          AND user_id IS NULL
        RETURNING
          id,
          workspace_id AS "workspaceId",
          user_id AS "userId",
          profile_slug AS "profileSlug",
          full_name AS "fullName",
          email,
          work_role AS "workRole",
          access_level AS "accessLevel",
          status,
          avatar_color AS "avatarColor",
          capacity_points AS "capacityPoints",
          updated_at::text AS "updatedAt"
      `;
      if (!profile) {
        throw new DomainError(409, "PROFILE_ACCOUNT_CONFLICT", "El perfil ya tiene una cuenta vinculada.");
      }

      await recordActivity(transaction, context, {
        boardId: null,
        entityType: "membership",
        entityId: profile.id,
        action: "account.linked",
        summary: `Se habilitó el acceso de «${profile.fullName}».`,
        metadata: {
          accessLevel: profile.accessLevel,
          status: profile.status,
          linkedAccount: true,
        },
      });

      return { profile, account };
    });
  } catch (error) {
    rethrowAccountDatabaseError(error);
  }
}
