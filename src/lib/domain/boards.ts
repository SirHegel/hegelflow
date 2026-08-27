import { db } from "@/lib/db";
import type { AccessLevel, ColumnCategory, WorkspaceContext } from "@/lib/types";
import {
  MANAGE_ACCESS,
  recordActivity,
  requireWorkspaceAccess,
} from "@/lib/domain/activity";
import {
  createBoardSchema,
  createColumnSchema,
  createProfileSchema,
  DomainError,
  parseDomainInput,
  rethrowDatabaseError,
  slugify,
  updateProfileSchema,
  type CreateBoardInput,
  type CreateColumnInput,
  type CreateProfileInput,
  type UpdateProfileInput,
} from "@/lib/domain/validators";

const DEFAULT_COLUMNS = [
  { name: "Backlog", category: "BACKLOG", position: 1_000, wipLimit: null, color: "#64748b" },
  { name: "Por hacer", category: "TODO", position: 2_000, wipLimit: 8, color: "#3b82f6" },
  { name: "En curso", category: "IN_PROGRESS", position: 3_000, wipLimit: 4, color: "#f59e0b" },
  { name: "En revisión", category: "REVIEW", position: 4_000, wipLimit: 3, color: "#a855f7" },
  { name: "Hecho", category: "DONE", position: 5_000, wipLimit: null, color: "#10b981" },
] as const satisfies readonly {
  name: string;
  category: ColumnCategory;
  position: number;
  wipLimit: number | null;
  color: string;
}[];

export type BoardMutationResult = {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string;
  methodology: "KANBAN" | "SCRUM" | "HYBRID";
  visibility: "WORKSPACE" | "PRIVATE";
  color: string;
  createdAt: string;
};

export type ColumnMutationResult = {
  id: string;
  boardId: string;
  name: string;
  category: ColumnCategory;
  position: number;
  wipLimit: number | null;
  color: string;
};

export type ProfileMutationResult = {
  id: string;
  workspaceId: string;
  userId: string | null;
  profileSlug: string;
  fullName: string;
  email: string | null;
  workRole: string;
  accessLevel: AccessLevel;
  status: "ACTIVE" | "INVITED" | "DISABLED";
  avatarColor: string;
  capacityPoints: number;
  updatedAt: string;
};

export async function createBoard(
  context: WorkspaceContext,
  rawInput: CreateBoardInput,
): Promise<{ board: BoardMutationResult; columns: ColumnMutationResult[] }> {
  const input = parseDomainInput(createBoardSchema, rawInput);
  const slug = input.slug ?? slugify(input.name);
  const sql = db();

  try {
    return await sql.begin(async (transaction) => {
      const actor = await requireWorkspaceAccess(transaction, context, MANAGE_ACCESS);
      const [board] = await transaction<BoardMutationResult[]>`
        INSERT INTO boards (
          workspace_id,
          name,
          slug,
          description,
          methodology,
          visibility,
          color,
          created_by
        ) VALUES (
          ${context.workspaceId},
          ${input.name},
          ${slug},
          ${input.description},
          ${input.methodology},
          ${input.visibility},
          ${input.color},
          ${actor.membershipId}
        )
        RETURNING
          id,
          workspace_id AS "workspaceId",
          name,
          slug,
          COALESCE(description, '') AS description,
          methodology,
          visibility,
          color,
          created_at::text AS "createdAt"
      `;
      if (!board) throw new DomainError(500, "BOARD_CREATE_FAILED", "No fue posible crear el tablero.");

      await transaction`
        INSERT INTO board_members (board_id, membership_id, access_level)
        VALUES (${board.id}, ${actor.membershipId}, 'ADMIN')
      `;

      const specs = input.columns ?? DEFAULT_COLUMNS;
      const columns: ColumnMutationResult[] = [];
      for (const [index, spec] of specs.entries()) {
        const [column] = await transaction<ColumnMutationResult[]>`
          INSERT INTO board_columns (board_id, name, category, position, wip_limit, color)
          VALUES (
            ${board.id},
            ${spec.name},
            ${spec.category},
            ${spec.position ?? (index + 1) * 1_000},
            ${spec.wipLimit},
            ${spec.color}
          )
          RETURNING
            id,
            board_id AS "boardId",
            name,
            category,
            position::float8 AS position,
            wip_limit AS "wipLimit",
            color
        `;
        if (!column) throw new DomainError(500, "COLUMN_CREATE_FAILED", "No fue posible crear una columna.");
        columns.push(column);
      }

      await recordActivity(transaction, context, {
        boardId: board.id,
        entityType: "board",
        entityId: board.id,
        action: "board.created",
        summary: `Se creó el tablero «${board.name}».`,
        metadata: { methodology: board.methodology, visibility: board.visibility },
      });

      return { board, columns };
    });
  } catch (error) {
    rethrowDatabaseError(error, "BOARD_SLUG_CONFLICT", "Ya existe un tablero con ese identificador.");
  }
}

export async function createColumn(
  context: WorkspaceContext,
  rawInput: CreateColumnInput,
): Promise<ColumnMutationResult> {
  const input = parseDomainInput(createColumnSchema, rawInput);
  const sql = db();

  try {
    return await sql.begin(async (transaction) => {
      await requireWorkspaceAccess(transaction, context, MANAGE_ACCESS);
      const [board] = await transaction<{ id: string }[]>`
        SELECT id
        FROM boards
        WHERE id = ${input.boardId}
          AND workspace_id = ${context.workspaceId}
          AND archived_at IS NULL
        FOR UPDATE
      `;
      if (!board) throw new DomainError(404, "BOARD_NOT_FOUND", "El tablero no existe en este espacio de trabajo.");

      const [duplicateName] = await transaction<{ id: string }[]>`
        SELECT id
        FROM board_columns
        WHERE board_id = ${board.id}
          AND LOWER(name) = LOWER(${input.name})
        LIMIT 1
        FOR SHARE
      `;
      if (duplicateName) {
        throw new DomainError(409, "COLUMN_NAME_CONFLICT", "Ya existe una columna con ese nombre en el tablero.");
      }

      const [order] = await transaction<{ nextPosition: number }[]>`
        SELECT (COALESCE(MAX(position), 0) + 1000)::float8 AS "nextPosition"
        FROM board_columns
        WHERE board_id = ${board.id}
      `;
      const [column] = await transaction<ColumnMutationResult[]>`
        INSERT INTO board_columns (board_id, name, category, position, wip_limit, color)
        VALUES (
          ${board.id},
          ${input.name},
          ${input.category},
          ${input.position ?? order?.nextPosition ?? 1_000},
          ${input.wipLimit},
          ${input.color}
        )
        RETURNING
          id,
          board_id AS "boardId",
          name,
          category,
          position::float8 AS position,
          wip_limit AS "wipLimit",
          color
      `;
      if (!column) throw new DomainError(500, "COLUMN_CREATE_FAILED", "No fue posible crear la columna.");

      await recordActivity(transaction, context, {
        boardId: board.id,
        entityType: "board_column",
        entityId: column.id,
        action: "board.column_created",
        summary: `Se añadió la columna «${column.name}».`,
        metadata: { boardId: board.id, category: column.category, wipLimit: column.wipLimit },
      });
      return column;
    });
  } catch (error) {
    rethrowDatabaseError(error, "COLUMN_NAME_CONFLICT", "Ya existe una columna con ese nombre en el tablero.");
  }
}

export const createBoardColumn = createColumn;

export async function createProfile(
  context: WorkspaceContext,
  rawInput: CreateProfileInput,
): Promise<ProfileMutationResult> {
  const input = parseDomainInput(createProfileSchema, rawInput);
  const profileSlug = input.profileSlug ?? slugify(input.fullName);
  const sql = db();

  try {
    return await sql.begin(async (transaction) => {
      const [workspace] = await transaction<{ id: string }[]>`
        SELECT id FROM workspaces WHERE id = ${context.workspaceId} FOR NO KEY UPDATE
      `;
      if (!workspace) throw new DomainError(404, "WORKSPACE_NOT_FOUND", "El espacio de trabajo no existe.");
      const actor = await requireWorkspaceAccess(transaction, context, MANAGE_ACCESS);

      if (input.accessLevel === "OWNER") {
        throw new DomainError(
          403,
          "ROLE_ESCALATION_DENIED",
          "No se puede crear otro propietario desde este flujo.",
        );
      }
      if (actor.accessLevel === "ADMIN" && ["OWNER", "ADMIN"].includes(input.accessLevel)) {
        throw new DomainError(403, "ROLE_ESCALATION_DENIED", "Solo un propietario puede conceder acceso administrativo.");
      }
      if (input.userId && actor.accessLevel !== "OWNER") {
        throw new DomainError(
          403,
          "ACCOUNT_LINK_DENIED",
          "Solo un propietario puede enlazar directamente una cuenta existente.",
        );
      }

      if (input.userId) {
        const [user] = await transaction<{ id: string }[]>`
          SELECT id FROM users WHERE id = ${input.userId} AND status <> 'DISABLED' FOR SHARE
        `;
        if (!user) throw new DomainError(422, "USER_NOT_AVAILABLE", "La cuenta indicada no está disponible.");
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
          ${input.userId},
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
      if (!profile) throw new DomainError(500, "PROFILE_CREATE_FAILED", "No fue posible crear el perfil.");

      await recordActivity(transaction, context, {
        boardId: null,
        entityType: "membership",
        entityId: profile.id,
        action: "profile.created",
        summary: `Se creó el perfil «${profile.fullName}».`,
        metadata: {
          accessLevel: profile.accessLevel,
          status: profile.status,
          linkedAccount: profile.userId !== null,
        },
      });
      return profile;
    });
  } catch (error) {
    rethrowDatabaseError(error, "PROFILE_CONFLICT", "Ya existe un perfil con ese identificador o cuenta.");
  }
}

export async function updateProfile(
  context: WorkspaceContext,
  rawInput: UpdateProfileInput,
): Promise<ProfileMutationResult> {
  const input = parseDomainInput(updateProfileSchema, rawInput);
  const sql = db();

  try {
    return await sql.begin(async (transaction) => {
      const [workspace] = await transaction<{ id: string }[]>`
        SELECT id FROM workspaces WHERE id = ${context.workspaceId} FOR NO KEY UPDATE
      `;
      if (!workspace) throw new DomainError(404, "WORKSPACE_NOT_FOUND", "El espacio de trabajo no existe.");
      const actor = await requireWorkspaceAccess(transaction, context, MANAGE_ACCESS);

      const [current] = await transaction<{
        id: string;
        fullName: string;
        accessLevel: AccessLevel;
        status: "ACTIVE" | "INVITED" | "DISABLED";
      }[]>`
        SELECT
          id,
          full_name AS "fullName",
          access_level AS "accessLevel",
          status
        FROM memberships
        WHERE id = ${input.membershipId}
          AND workspace_id = ${context.workspaceId}
        FOR UPDATE
      `;
      if (!current) throw new DomainError(404, "PROFILE_NOT_FOUND", "El perfil no existe en este espacio de trabajo.");

      if (
        actor.accessLevel === "ADMIN" &&
        (current.accessLevel === "OWNER" ||
          current.accessLevel === "ADMIN" ||
          input.accessLevel === "OWNER" ||
          input.accessLevel === "ADMIN")
      ) {
        throw new DomainError(403, "ROLE_ESCALATION_DENIED", "Solo un propietario puede gestionar perfiles administrativos.");
      }

      const nextAccessLevel = input.accessLevel ?? current.accessLevel;
      const nextStatus = input.status ?? current.status;
      if (
        current.accessLevel === "OWNER" &&
        current.status === "ACTIVE" &&
        (nextAccessLevel !== "OWNER" || nextStatus !== "ACTIVE")
      ) {
        const otherOwners = await transaction<{ id: string }[]>`
          SELECT id
          FROM memberships
          WHERE workspace_id = ${context.workspaceId}
            AND id <> ${current.id}
            AND access_level = 'OWNER'
            AND status = 'ACTIVE'
          FOR SHARE
        `;
        if (otherOwners.length === 0) {
          throw new DomainError(409, "LAST_OWNER_REQUIRED", "El espacio debe conservar al menos un propietario activo.");
        }
      }

      const [profile] = await transaction<ProfileMutationResult[]>`
        UPDATE memberships
        SET
          profile_slug = CASE WHEN ${input.profileSlug !== undefined} THEN ${input.profileSlug ?? ""} ELSE profile_slug END,
          full_name = CASE WHEN ${input.fullName !== undefined} THEN ${input.fullName ?? ""} ELSE full_name END,
          email = CASE WHEN ${input.email !== undefined} THEN ${input.email ?? null} ELSE email END,
          work_role = CASE WHEN ${input.workRole !== undefined} THEN ${input.workRole ?? ""} ELSE work_role END,
          access_level = CASE WHEN ${input.accessLevel !== undefined} THEN ${input.accessLevel ?? current.accessLevel} ELSE access_level END,
          status = CASE WHEN ${input.status !== undefined} THEN ${input.status ?? current.status} ELSE status END,
          avatar_color = CASE WHEN ${input.avatarColor !== undefined} THEN ${input.avatarColor ?? ""} ELSE avatar_color END,
          capacity_points = CASE WHEN ${input.capacityPoints !== undefined} THEN ${input.capacityPoints ?? 0} ELSE capacity_points END
        WHERE id = ${current.id}
          AND workspace_id = ${context.workspaceId}
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
      if (!profile) throw new DomainError(500, "PROFILE_UPDATE_FAILED", "No fue posible actualizar el perfil.");

      await recordActivity(transaction, context, {
        boardId: null,
        entityType: "membership",
        entityId: profile.id,
        action: "profile.updated",
        summary: `Se actualizó el perfil «${profile.fullName}».`,
        metadata: {
          fromAccessLevel: current.accessLevel,
          toAccessLevel: profile.accessLevel,
          fromStatus: current.status,
          toStatus: profile.status,
        },
      });
      return profile;
    });
  } catch (error) {
    rethrowDatabaseError(error, "PROFILE_CONFLICT", "Ya existe un perfil con ese identificador.");
  }
}
