import { db } from "@/lib/db";
import type { SprintStatus, WorkspaceContext } from "@/lib/types";
import {
  assertVersion,
  MANAGE_ACCESS,
  recordActivity,
  requireBoardWriteAccess,
  requireWorkspaceAccess,
  TASK_WRITE_ACCESS,
} from "@/lib/domain/activity";
import {
  assignTaskToSprintSchema,
  closeSprintSchema,
  createSprintSchema,
  DomainError,
  parseDomainInput,
  rethrowDatabaseError,
  startSprintSchema,
  type AssignTaskToSprintInput,
  type CloseSprintInput,
  type CreateSprintInput,
  type StartSprintInput,
} from "@/lib/domain/validators";

export type SprintMutationResult = {
  id: string;
  workspaceId: string;
  boardId: string | null;
  name: string;
  goal: string | null;
  status: SprintStatus;
  startDate: string | null;
  endDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SprintAssignmentResult = {
  taskId: string;
  boardId: string;
  sprintId: string | null;
  title: string;
  storyPoints: number | null;
  version: number;
  updatedAt: string;
};

type LockedSprint = {
  id: string;
  boardId: string | null;
  name: string;
  status: SprintStatus;
  startDate: string | null;
  endDate: string | null;
};

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export async function createSprint(
  context: WorkspaceContext,
  rawInput: CreateSprintInput,
): Promise<SprintMutationResult> {
  const input = parseDomainInput(createSprintSchema, rawInput);
  const sql = db();

  return sql.begin(async (transaction) => {
    await requireWorkspaceAccess(transaction, context, MANAGE_ACCESS);
    if (input.boardId) {
      const [board] = await transaction<{ id: string }[]>`
        SELECT id
        FROM boards
        WHERE id = ${input.boardId}
          AND workspace_id = ${context.workspaceId}
          AND archived_at IS NULL
        FOR SHARE
      `;
      if (!board) throw new DomainError(422, "INVALID_BOARD", "El tablero no pertenece al espacio de trabajo.");
    }

    const [created] = await transaction<{ id: string }[]>`
      INSERT INTO sprints (workspace_id, board_id, name, goal, status, start_date, end_date)
      VALUES (
        ${context.workspaceId},
        ${input.boardId},
        ${input.name},
        ${input.goal},
        'PLANNED',
        ${input.startDate},
        ${input.endDate}
      )
      RETURNING id
    `;
    if (!created) throw new DomainError(500, "SPRINT_CREATE_FAILED", "No fue posible crear el sprint.");

    const [sprint] = await transaction<SprintMutationResult[]>`
      SELECT
        id,
        workspace_id AS "workspaceId",
        board_id AS "boardId",
        name,
        goal,
        status,
        start_date::text AS "startDate",
        end_date::text AS "endDate",
        completed_at::text AS "completedAt",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
      FROM sprints
      WHERE id = ${created.id}
    `;
    if (!sprint) throw new DomainError(500, "SPRINT_CREATE_FAILED", "No fue posible recuperar el sprint.");
    await recordActivity(transaction, context, {
      boardId: sprint.boardId,
      entityType: "sprint",
      entityId: sprint.id,
      action: "sprint.created",
      summary: `Se creó el sprint «${sprint.name}».`,
      metadata: { boardId: sprint.boardId },
    });
    return sprint;
  });
}

export async function startSprint(
  context: WorkspaceContext,
  rawInput: StartSprintInput,
): Promise<SprintMutationResult> {
  const input = parseDomainInput(startSprintSchema, rawInput);
  const sql = db();

  try {
    return await sql.begin(async (transaction) => {
      const [workspace] = await transaction<{ id: string }[]>`
        SELECT id FROM workspaces WHERE id = ${context.workspaceId} FOR NO KEY UPDATE
      `;
      if (!workspace) throw new DomainError(404, "WORKSPACE_NOT_FOUND", "El espacio de trabajo no existe.");
      await requireWorkspaceAccess(transaction, context, MANAGE_ACCESS);

      const [current] = await transaction<LockedSprint[]>`
        SELECT
          id,
          board_id AS "boardId",
          name,
          status,
          start_date::text AS "startDate",
          end_date::text AS "endDate"
        FROM sprints
        WHERE id = ${input.sprintId}
          AND workspace_id = ${context.workspaceId}
        FOR UPDATE
      `;
      if (!current) throw new DomainError(404, "SPRINT_NOT_FOUND", "El sprint no existe.");
      if (current.status !== "PLANNED") {
        throw new DomainError(409, "SPRINT_STATE_CONFLICT", "Solo se puede iniciar un sprint planificado.");
      }

      const [active] = await transaction<{ id: string }[]>`
        SELECT id
        FROM sprints
        WHERE workspace_id = ${context.workspaceId}
          AND status = 'ACTIVE'
          AND id <> ${current.id}
          AND board_id IS NOT DISTINCT FROM ${current.boardId}
        FOR UPDATE
      `;
      if (active) {
        throw new DomainError(
          409,
          "ACTIVE_SPRINT_EXISTS",
          "Ya existe un sprint activo para este tablero o planificación general.",
        );
      }

      const [clock] = await transaction<{ today: string }[]>`
        SELECT CURRENT_DATE::text AS today
      `;
      if (!clock) throw new DomainError(500, "CLOCK_READ_FAILED", "No fue posible determinar la fecha actual.");
      const startDate = input.startDate ?? current.startDate ?? clock.today;
      const endDate = input.endDate ?? current.endDate ?? addDays(startDate, 13);
      if (startDate > clock.today) {
        throw new DomainError(422, "SPRINT_START_IN_FUTURE", "Un sprint activo no puede comenzar en una fecha futura.");
      }
      if (endDate < startDate) {
        throw new DomainError(422, "INVALID_DATE_RANGE", "La fecha final no puede ser anterior al inicio.");
      }

      const [started] = await transaction<SprintMutationResult[]>`
        UPDATE sprints
        SET
          status = 'ACTIVE',
          start_date = ${startDate},
          end_date = ${endDate},
          completed_at = NULL
        WHERE id = ${current.id} AND status = 'PLANNED'
        RETURNING
          id,
          workspace_id AS "workspaceId",
          board_id AS "boardId",
          name,
          goal,
          status,
          start_date::text AS "startDate",
          end_date::text AS "endDate",
          completed_at::text AS "completedAt",
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt"
      `;
      if (!started) throw new DomainError(409, "SPRINT_STATE_CONFLICT", "El sprint cambió de estado.");
      await recordActivity(transaction, context, {
        boardId: started.boardId,
        entityType: "sprint",
        entityId: started.id,
        action: "sprint.started",
        summary: `Se inició el sprint «${current.name}».`,
        metadata: { startDate, endDate, boardId: current.boardId },
      });
      return started;
    });
  } catch (error) {
    rethrowDatabaseError(
      error,
      "ACTIVE_SPRINT_EXISTS",
      "Ya existe un sprint activo para este tablero o planificación general.",
    );
  }
}

export async function closeSprint(
  context: WorkspaceContext,
  rawInput: CloseSprintInput,
): Promise<{ sprint: SprintMutationResult; movedIncompleteTasks: number }> {
  const input = parseDomainInput(closeSprintSchema, rawInput);
  const sql = db();

  try {
    return await sql.begin(async (transaction) => {
      const [workspace] = await transaction<{ id: string }[]>`
        SELECT id FROM workspaces WHERE id = ${context.workspaceId} FOR NO KEY UPDATE
      `;
      if (!workspace) throw new DomainError(404, "WORKSPACE_NOT_FOUND", "El espacio de trabajo no existe.");
      const actor = await requireWorkspaceAccess(transaction, context, MANAGE_ACCESS);

    const [current] = await transaction<LockedSprint[]>`
      SELECT
        id,
        board_id AS "boardId",
        name,
        status,
        start_date::text AS "startDate",
        end_date::text AS "endDate"
      FROM sprints
      WHERE id = ${input.sprintId}
        AND workspace_id = ${context.workspaceId}
      FOR UPDATE
    `;
    if (!current) throw new DomainError(404, "SPRINT_NOT_FOUND", "El sprint no existe.");
    if (current.status !== "ACTIVE") {
      throw new DomainError(409, "SPRINT_STATE_CONFLICT", "Solo se puede cerrar un sprint activo.");
    }
    const [clock] = await transaction<{ today: string }[]>`
      SELECT CURRENT_DATE::text AS today
    `;
    if (!clock) throw new DomainError(500, "CLOCK_READ_FAILED", "No fue posible determinar la fecha actual.");
    if (current.startDate && current.startDate > clock.today) {
      throw new DomainError(409, "SPRINT_NOT_STARTED", "No se puede cerrar un sprint antes de su fecha inicial.");
    }

    let targetSprintId: string | null = null;
    let targetSprintName: string | null = null;
    if (input.incompleteDestination === "SPRINT") {
      const [target] = await transaction<{ id: string; name: string; boardId: string | null }[]>`
        SELECT id, name, board_id AS "boardId"
        FROM sprints
        WHERE id = ${input.targetSprintId}
          AND workspace_id = ${context.workspaceId}
          AND status = 'PLANNED'
        FOR UPDATE
      `;
      if (!target) {
        throw new DomainError(422, "INVALID_TARGET_SPRINT", "El sprint de destino no está disponible.");
      }
      if (target.boardId) {
        const [incompatible] = await transaction<{ id: string }[]>`
          SELECT t.id
          FROM tasks t
          JOIN boards b ON b.id = t.board_id
          WHERE t.sprint_id = ${current.id}
            AND t.completed_at IS NULL
            AND t.archived_at IS NULL
            AND b.workspace_id = ${context.workspaceId}
            AND t.board_id <> ${target.boardId}
          LIMIT 1
          FOR SHARE OF t
        `;
        if (incompatible) {
          throw new DomainError(
            422,
            "INCOMPATIBLE_TARGET_SPRINT",
            "El sprint de destino no admite todas las tareas incompletas.",
          );
        }
      }
      targetSprintId = target.id;
      targetSprintName = target.name;
    }

    await transaction`
      SELECT t.id
      FROM tasks t
      JOIN boards b ON b.id = t.board_id
      WHERE t.sprint_id = ${current.id}
        AND t.completed_at IS NULL
        AND t.archived_at IS NULL
        AND b.workspace_id = ${context.workspaceId}
      ORDER BY t.id
      FOR UPDATE OF t
    `;
    const movedTasks = await transaction<{
      id: string;
      columnId: string;
      storyPoints: number | null;
    }[]>`
      UPDATE tasks t
      SET sprint_id = ${targetSprintId}, version = t.version + 1
      FROM boards b
      WHERE t.board_id = b.id
        AND b.workspace_id = ${context.workspaceId}
        AND t.sprint_id = ${current.id}
        AND t.completed_at IS NULL
        AND t.archived_at IS NULL
      RETURNING t.id, t.column_id AS "columnId", t.story_points AS "storyPoints"
    `;
    for (const task of movedTasks) {
      await transaction`
        INSERT INTO task_transitions (
          task_id, from_column_id, to_column_id, from_sprint_id, to_sprint_id,
          actor_id, event_type, story_points_at_event
        ) VALUES (
          ${task.id}, ${task.columnId}, ${task.columnId}, ${current.id}, ${targetSprintId},
          ${actor.membershipId}, 'SPRINT_CHANGED', ${task.storyPoints}
        )
      `;
    }

    const [closed] = await transaction<SprintMutationResult[]>`
      UPDATE sprints
      SET status = 'COMPLETED', completed_at = NOW(), end_date = CURRENT_DATE
      WHERE id = ${current.id} AND status = 'ACTIVE'
      RETURNING
        id,
        workspace_id AS "workspaceId",
        board_id AS "boardId",
        name,
        goal,
        status,
        start_date::text AS "startDate",
        end_date::text AS "endDate",
        completed_at::text AS "completedAt",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
    `;
    if (!closed) throw new DomainError(409, "SPRINT_STATE_CONFLICT", "El sprint cambió de estado.");

    await recordActivity(transaction, context, {
      boardId: closed.boardId,
      entityType: "sprint",
      entityId: closed.id,
      action: "sprint.completed",
      summary: `Se cerró el sprint «${current.name}».`,
      metadata: {
        incompleteTasks: movedTasks.length,
        destination: input.incompleteDestination,
        targetSprintId,
        targetSprintName,
      },
    });
      return { sprint: closed, movedIncompleteTasks: movedTasks.length };
    });
  } catch (error) {
    rethrowDatabaseError(error, "SPRINT_CONFLICT", "No fue posible cerrar el sprint por un conflicto de datos.");
  }
}

export async function assignTaskToSprint(
  context: WorkspaceContext,
  rawInput: AssignTaskToSprintInput,
): Promise<SprintAssignmentResult> {
  const input = parseDomainInput(assignTaskToSprintSchema, rawInput);
  const sql = db();

  try {
    return await sql.begin(async (transaction) => {
      const [workspace] = await transaction<{ id: string }[]>`
        SELECT id FROM workspaces WHERE id = ${context.workspaceId} FOR NO KEY UPDATE
      `;
      if (!workspace) throw new DomainError(404, "WORKSPACE_NOT_FOUND", "El espacio de trabajo no existe.");
      const actor = await requireWorkspaceAccess(transaction, context, TASK_WRITE_ACCESS);
    const [task] = await transaction<{
      id: string;
      boardId: string;
      columnId: string;
      sprintId: string | null;
      title: string;
      storyPoints: number | null;
      version: number;
      updatedAt: string;
      visibility: "WORKSPACE" | "PRIVATE";
      currentSprintStatus: SprintStatus | null;
    }[]>`
      SELECT
        t.id,
        t.board_id AS "boardId",
        t.column_id AS "columnId",
        t.sprint_id AS "sprintId",
        t.title,
        t.story_points AS "storyPoints",
        t.version,
        t.updated_at::text AS "updatedAt",
        b.visibility,
        current_sprint.status AS "currentSprintStatus"
      FROM tasks t
      JOIN boards b ON b.id = t.board_id
      LEFT JOIN sprints current_sprint ON current_sprint.id = t.sprint_id
      WHERE t.id = ${input.taskId}
        AND b.workspace_id = ${context.workspaceId}
        AND b.archived_at IS NULL
        AND t.archived_at IS NULL
      FOR UPDATE OF t
    `;
    if (!task) throw new DomainError(404, "TASK_NOT_FOUND", "La tarea no existe en este espacio de trabajo.");
    await requireBoardWriteAccess(
      transaction,
      context,
      actor.accessLevel,
      task.boardId,
      task.visibility,
    );
    assertVersion(task.version, input.expectedVersion);

    if (task.sprintId === input.sprintId) {
      return {
        taskId: task.id,
        boardId: task.boardId,
        sprintId: task.sprintId,
        title: task.title,
        storyPoints: task.storyPoints,
        version: task.version,
        updatedAt: task.updatedAt,
      };
    }
    if (task.currentSprintStatus === "COMPLETED" || task.currentSprintStatus === "CANCELLED") {
      throw new DomainError(
        409,
        "CLOSED_SPRINT_IMMUTABLE",
        "Las tareas de un sprint cerrado no se pueden modificar ni reasignar.",
        { sprintId: task.sprintId, sprintStatus: task.currentSprintStatus },
      );
    }

    if (input.sprintId) {
      const [sprint] = await transaction<{ id: string }[]>`
        SELECT id
        FROM sprints
        WHERE id = ${input.sprintId}
          AND workspace_id = ${context.workspaceId}
          AND status IN ('PLANNED', 'ACTIVE')
          AND (board_id IS NULL OR board_id = ${task.boardId})
        FOR SHARE
      `;
      if (!sprint) throw new DomainError(422, "INVALID_SPRINT", "El sprint no está disponible para esta tarea.");
    }

    const [updated] = await transaction<SprintAssignmentResult[]>`
      UPDATE tasks
      SET sprint_id = ${input.sprintId}, version = version + 1
      WHERE id = ${task.id} AND version = ${input.expectedVersion}
      RETURNING
        id AS "taskId",
        board_id AS "boardId",
        sprint_id AS "sprintId",
        title,
        story_points AS "storyPoints",
        version,
        updated_at::text AS "updatedAt"
    `;
    if (!updated) throw new DomainError(409, "VERSION_CONFLICT", "La tarea fue modificada por otra operación.");

    await transaction`
      INSERT INTO task_transitions (
        task_id, from_column_id, to_column_id, from_sprint_id, to_sprint_id,
        actor_id, event_type, story_points_at_event
      ) VALUES (
        ${task.id}, ${task.columnId}, ${task.columnId}, ${task.sprintId}, ${input.sprintId},
        ${actor.membershipId}, 'SPRINT_CHANGED', ${task.storyPoints}
      )
    `;
    await recordActivity(transaction, context, {
      boardId: task.boardId,
      entityType: "task",
      entityId: task.id,
      action: "task.sprint_changed",
      summary: input.sprintId
        ? `Se asignó la tarea «${task.title}» a un sprint.`
        : `Se devolvió la tarea «${task.title}» al backlog.`,
      metadata: { fromSprintId: task.sprintId, toSprintId: input.sprintId, version: updated.version },
    });
      return updated;
    });
  } catch (error) {
    rethrowDatabaseError(error, "SPRINT_ASSIGNMENT_CONFLICT", "No fue posible asignar el sprint por un conflicto de datos.");
  }
}

export const assignSprint = assignTaskToSprint;
