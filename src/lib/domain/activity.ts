import type postgres from "postgres";

import type { AccessLevel, WorkspaceContext } from "@/lib/types";
import { DomainError } from "@/lib/domain/validators";

export type DomainTransaction = postgres.TransactionSql;

export const TASK_WRITE_ACCESS = ["OWNER", "ADMIN", "MEMBER"] as const satisfies readonly AccessLevel[];
export const MANAGE_ACCESS = ["OWNER", "ADMIN"] as const satisfies readonly AccessLevel[];
export const OWNER_ACCESS = ["OWNER"] as const satisfies readonly AccessLevel[];

export type WorkspaceActor = {
  membershipId: string;
  userId: string;
  fullName: string;
  accessLevel: AccessLevel;
};

export type ActivityInput = {
  boardId: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  summary: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export async function requireWorkspaceAccess(
  sql: DomainTransaction,
  context: WorkspaceContext,
  allowed: readonly AccessLevel[],
): Promise<WorkspaceActor> {
  const [actor] = await sql<{
    membershipId: string;
    userId: string;
    fullName: string;
    accessLevel: AccessLevel;
  }[]>`
    SELECT
      m.id AS "membershipId",
      m.user_id AS "userId",
      m.full_name AS "fullName",
      m.access_level AS "accessLevel"
    FROM memberships m
    JOIN users u ON u.id = m.user_id
    WHERE m.id = ${context.membershipId}
      AND m.workspace_id = ${context.workspaceId}
      AND m.user_id = ${context.userId}
      AND m.status = 'ACTIVE'
      AND u.status = 'ACTIVE'
    FOR SHARE
  `;

  if (!actor) {
    throw new DomainError(403, "WORKSPACE_ACCESS_DENIED", "No tiene acceso activo a este espacio de trabajo.");
  }
  if (!allowed.includes(actor.accessLevel)) {
    throw new DomainError(403, "FORBIDDEN", "Su perfil no tiene permiso para realizar esta acción.");
  }

  return actor;
}

export async function recordActivity(
  sql: DomainTransaction,
  context: WorkspaceContext,
  input: ActivityInput,
): Promise<string> {
  const [activity] = await sql<{ id: string }[]>`
    INSERT INTO activity_log (
      workspace_id,
      board_id,
      actor_id,
      entity_type,
      entity_id,
      action,
      summary,
      metadata
    ) VALUES (
      ${context.workspaceId},
      ${input.boardId},
      ${context.membershipId},
      ${input.entityType.slice(0, 40)},
      ${input.entityId ?? null},
      ${input.action.slice(0, 60)},
      ${input.summary},
      ${sql.json(input.metadata ?? {})}
    )
    RETURNING id
  `;

  if (!activity) {
    throw new DomainError(500, "ACTIVITY_WRITE_FAILED", "No fue posible registrar la actividad.");
  }
  return activity.id;
}

export function assertVersion(actual: number, expected: number): void {
  if (actual !== expected) {
    throw new DomainError(
      409,
      "VERSION_CONFLICT",
      "El recurso cambió desde que fue cargado. Actualice la vista e inténtelo de nuevo.",
      { expectedVersion: expected, currentVersion: actual },
    );
  }
}

export async function requireBoardWriteAccess(
  sql: DomainTransaction,
  context: WorkspaceContext,
  accessLevel: AccessLevel,
  boardId: string,
  visibility: "WORKSPACE" | "PRIVATE",
): Promise<void> {
  if (visibility !== "PRIVATE" || accessLevel === "OWNER" || accessLevel === "ADMIN") {
    return;
  }

  const [boardAccess] = await sql<{ accessLevel: "ADMIN" | "MEMBER" }[]>`
    SELECT bm.access_level AS "accessLevel"
    FROM board_members bm
    JOIN boards b ON b.id = bm.board_id
    WHERE bm.board_id = ${boardId}
      AND bm.membership_id = ${context.membershipId}
      AND bm.access_level IN ('ADMIN', 'MEMBER')
      AND b.workspace_id = ${context.workspaceId}
      AND b.archived_at IS NULL
    FOR SHARE OF bm
  `;
  if (!boardAccess) {
    throw new DomainError(403, "PRIVATE_BOARD_ACCESS_DENIED", "No tiene permiso para modificar este tablero privado.");
  }
}
