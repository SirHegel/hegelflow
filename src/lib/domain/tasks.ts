import { db } from "@/lib/db";
import type {
  ColumnCategory,
  SprintStatus,
  TaskPriority,
  TaskType,
  WorkspaceContext,
} from "@/lib/types";
import {
  assertVersion,
  MANAGE_ACCESS,
  recordActivity,
  requireBoardWriteAccess,
  requireWorkspaceAccess,
  TASK_WRITE_ACCESS,
  type DomainTransaction,
} from "@/lib/domain/activity";
import {
  archiveTaskSchema,
  createChecklistItemSchema,
  createChecklistSchema,
  createCommentSchema,
  createTaskSchema,
  deleteCommentSchema,
  DomainError,
  moveTaskSchema,
  parseDomainInput,
  rethrowDatabaseError,
  updateChecklistItemSchema,
  updateCommentSchema,
  updateTaskSchema,
  type ArchiveTaskInput,
  type CreateChecklistInput,
  type CreateChecklistItemInput,
  type CreateCommentInput,
  type CreateTaskInput,
  type DeleteCommentInput,
  type MoveTaskInput,
  type UpdateChecklistItemInput,
  type UpdateCommentInput,
  type UpdateTaskInput,
} from "@/lib/domain/validators";

export type TaskMutationResult = {
  id: string;
  boardId: string;
  columnId: string;
  sprintId: string | null;
  parentTaskId: string | null;
  taskNumber: number;
  title: string;
  description: string;
  taskType: TaskType;
  priority: TaskPriority;
  position: number;
  storyPoints: number | null;
  estimateMinutes: number | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  version: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommentMutationResult = {
  id: string;
  taskId: string;
  authorId: string | null;
  body: string;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChecklistMutationResult = {
  id: string;
  taskId: string;
  title: string;
  position: number;
  createdAt: string;
};

export type ChecklistItemMutationResult = {
  id: string;
  checklistId: string;
  content: string;
  isComplete: boolean;
  position: number;
  completedBy: string | null;
  completedAt: string | null;
  updatedAt: string;
};

type LockedTask = {
  id: string;
  boardId: string;
  columnId: string;
  sprintId: string | null;
  title: string;
  version: number;
  storyPoints: number | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  category: ColumnCategory;
  sprintStatus: SprintStatus | null;
  visibility: "WORKSPACE" | "PRIVATE";
};

type LockedColumn = {
  id: string;
  boardId: string;
  category: ColumnCategory;
  wipLimit: number | null;
};

async function readTaskResult(
  transaction: DomainTransaction,
  taskId: string,
): Promise<TaskMutationResult> {
  const [task] = await transaction<TaskMutationResult[]>`
    SELECT
      id,
      board_id AS "boardId",
      column_id AS "columnId",
      sprint_id AS "sprintId",
      parent_task_id AS "parentTaskId",
      task_number AS "taskNumber",
      title,
      description,
      task_type AS "taskType",
      priority,
      position::float8 AS position,
      story_points AS "storyPoints",
      estimate_minutes AS "estimateMinutes",
      start_date::text AS "startDate",
      due_date::text AS "dueDate",
      completed_at::text AS "completedAt",
      version,
      archived_at::text AS "archivedAt",
      created_at::text AS "createdAt",
      updated_at::text AS "updatedAt"
    FROM tasks
    WHERE id = ${taskId}
  `;
  if (!task) throw new DomainError(500, "TASK_READ_FAILED", "No fue posible recuperar la tarea modificada.");
  return task;
}

async function lockTask(
  transaction: DomainTransaction,
  context: WorkspaceContext,
  taskId: string,
  accessLevel: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER",
): Promise<LockedTask> {
  const [task] = await transaction<LockedTask[]>`
    SELECT
      t.id,
      t.board_id AS "boardId",
      t.column_id AS "columnId",
      t.sprint_id AS "sprintId",
      t.title,
      t.version,
      t.story_points AS "storyPoints",
      t.start_date::text AS "startDate",
      t.due_date::text AS "dueDate",
      t.completed_at::text AS "completedAt",
      c.category,
      s.status AS "sprintStatus",
      b.visibility
    FROM tasks t
    JOIN boards b ON b.id = t.board_id
    JOIN board_columns c ON c.id = t.column_id
    LEFT JOIN sprints s ON s.id = t.sprint_id
    WHERE t.id = ${taskId}
      AND b.workspace_id = ${context.workspaceId}
      AND b.archived_at IS NULL
      AND t.archived_at IS NULL
    FOR UPDATE OF t
  `;
  if (!task) throw new DomainError(404, "TASK_NOT_FOUND", "La tarea no existe en este espacio de trabajo.");
  await requireBoardWriteAccess(
    transaction,
    context,
    accessLevel,
    task.boardId,
    task.visibility,
  );
  return task;
}

async function lockWorkspaceForTaskMutation(
  transaction: DomainTransaction,
  context: WorkspaceContext,
): Promise<void> {
  const [workspace] = await transaction<{ id: string }[]>`
    SELECT id
    FROM workspaces
    WHERE id = ${context.workspaceId}
    FOR NO KEY UPDATE
  `;
  if (!workspace) {
    throw new DomainError(404, "WORKSPACE_NOT_FOUND", "El espacio de trabajo no existe.");
  }
}

function assertTaskSprintMutable(task: LockedTask): void {
  if (task.sprintStatus === "COMPLETED" || task.sprintStatus === "CANCELLED") {
    throw new DomainError(
      409,
      "CLOSED_SPRINT_IMMUTABLE",
      "Las tareas de un sprint cerrado no se pueden modificar ni reasignar.",
      { sprintId: task.sprintId, sprintStatus: task.sprintStatus },
    );
  }
}

async function lockTaskBoardForHierarchyChange(
  transaction: DomainTransaction,
  context: WorkspaceContext,
  taskId: string,
): Promise<void> {
  const [board] = await transaction<{ id: string }[]>`
    SELECT b.id
    FROM boards b
    JOIN tasks t ON t.board_id = b.id
    WHERE t.id = ${taskId}
      AND b.workspace_id = ${context.workspaceId}
      AND b.archived_at IS NULL
      AND t.archived_at IS NULL
    FOR UPDATE OF b
  `;
  if (!board) throw new DomainError(404, "TASK_NOT_FOUND", "La tarea no existe en este espacio de trabajo.");
}

async function ensureSprint(
  transaction: DomainTransaction,
  context: WorkspaceContext,
  sprintId: string | null,
  boardId: string,
): Promise<void> {
  if (!sprintId) return;
  const [sprint] = await transaction<{ id: string }[]>`
    SELECT id
    FROM sprints
    WHERE id = ${sprintId}
      AND workspace_id = ${context.workspaceId}
      AND status IN ('PLANNED', 'ACTIVE')
      AND (board_id IS NULL OR board_id = ${boardId})
    FOR SHARE
  `;
  if (!sprint) {
    throw new DomainError(422, "INVALID_SPRINT", "El sprint no está disponible para este tablero.");
  }
}

async function ensureParentTask(
  transaction: DomainTransaction,
  context: WorkspaceContext,
  parentTaskId: string | null,
  boardId: string,
  taskId?: string,
): Promise<void> {
  if (!parentTaskId) return;
  if (parentTaskId === taskId) {
    throw new DomainError(422, "INVALID_PARENT_TASK", "Una tarea no puede ser su propia tarea superior.");
  }
  const [parent] = await transaction<{ id: string }[]>`
    SELECT t.id
    FROM tasks t
    JOIN boards b ON b.id = t.board_id
    WHERE t.id = ${parentTaskId}
      AND t.board_id = ${boardId}
      AND b.workspace_id = ${context.workspaceId}
      AND t.archived_at IS NULL
    FOR SHARE OF t
  `;
  if (!parent) {
    throw new DomainError(422, "INVALID_PARENT_TASK", "La tarea superior no pertenece al mismo tablero.");
  }

  if (taskId) {
    const [cycle] = await transaction<{ id: string }[]>`
      WITH RECURSIVE descendants AS (
        SELECT id
        FROM tasks
        WHERE parent_task_id = ${taskId}
          AND board_id = ${boardId}
          AND archived_at IS NULL

        UNION

        SELECT child.id
        FROM tasks child
        JOIN descendants parent_descendant ON child.parent_task_id = parent_descendant.id
        WHERE child.board_id = ${boardId}
          AND child.archived_at IS NULL
      )
      SELECT id
      FROM descendants
      WHERE id = ${parentTaskId}
      LIMIT 1
    `;
    if (cycle) {
      throw new DomainError(
        422,
        "PARENT_TASK_CYCLE",
        "La tarea superior elegida crearía una relación circular.",
      );
    }
  }
}

async function ensureMemberships(
  transaction: DomainTransaction,
  context: WorkspaceContext,
  membershipIds: string[],
): Promise<void> {
  if (membershipIds.length === 0) return;
  const rows = await transaction<{ id: string }[]>`
    SELECT id
    FROM memberships
    WHERE workspace_id = ${context.workspaceId}
      AND status = 'ACTIVE'
      AND id IN (
        SELECT value::uuid
        FROM jsonb_array_elements_text(${transaction.json(membershipIds)}::jsonb)
      )
    FOR SHARE
  `;
  if (rows.length !== membershipIds.length) {
    throw new DomainError(422, "INVALID_ASSIGNEE", "Uno o más responsables no pertenecen al espacio de trabajo.");
  }
}

async function ensureLabels(
  transaction: DomainTransaction,
  context: WorkspaceContext,
  labelIds: string[],
): Promise<void> {
  if (labelIds.length === 0) return;
  const rows = await transaction<{ id: string }[]>`
    SELECT id
    FROM labels
    WHERE workspace_id = ${context.workspaceId}
      AND id IN (
        SELECT value::uuid
        FROM jsonb_array_elements_text(${transaction.json(labelIds)}::jsonb)
      )
    FOR SHARE
  `;
  if (rows.length !== labelIds.length) {
    throw new DomainError(422, "INVALID_LABEL", "Una o más etiquetas no pertenecen al espacio de trabajo.");
  }
}

async function replaceAssignees(
  transaction: DomainTransaction,
  taskId: string,
  membershipIds: string[],
): Promise<void> {
  await transaction`DELETE FROM task_assignees WHERE task_id = ${taskId}`;
  if (membershipIds.length === 0) return;
  await transaction`
    INSERT INTO task_assignees (task_id, membership_id)
    SELECT ${taskId}, value::uuid
    FROM jsonb_array_elements_text(${transaction.json(membershipIds)}::jsonb)
  `;
}

async function replaceLabels(
  transaction: DomainTransaction,
  taskId: string,
  labelIds: string[],
): Promise<void> {
  await transaction`DELETE FROM task_labels WHERE task_id = ${taskId}`;
  if (labelIds.length === 0) return;
  await transaction`
    INSERT INTO task_labels (task_id, label_id)
    SELECT ${taskId}, value::uuid
    FROM jsonb_array_elements_text(${transaction.json(labelIds)}::jsonb)
  `;
}

async function assertWipAvailable(
  transaction: DomainTransaction,
  column: LockedColumn,
  excludingTaskId?: string,
): Promise<void> {
  if (column.wipLimit === null) return;
  const [usage] = await transaction<{ activeTasks: number }[]>`
    SELECT COUNT(*)::int AS "activeTasks"
    FROM tasks
    WHERE column_id = ${column.id}
      AND archived_at IS NULL
      AND (${excludingTaskId ?? null}::uuid IS NULL OR id <> ${excludingTaskId ?? null})
  `;
  if ((usage?.activeTasks ?? 0) >= column.wipLimit) {
    throw new DomainError(
      409,
      "WIP_LIMIT_REACHED",
      `La columna alcanzó su límite WIP de ${column.wipLimit} tareas.`,
      { columnId: column.id, wipLimit: column.wipLimit },
    );
  }
}

async function getLastPosition(
  transaction: DomainTransaction,
  columnId: string,
  excludingTaskId?: string,
): Promise<number> {
  const [row] = await transaction<{ position: number }[]>`
    SELECT (COALESCE(MAX(position), 0) + 1000)::float8 AS position
    FROM tasks
    WHERE column_id = ${columnId}
      AND archived_at IS NULL
      AND (${excludingTaskId ?? null}::uuid IS NULL OR id <> ${excludingTaskId ?? null})
  `;
  return row?.position ?? 1_000;
}

async function readAnchor(
  transaction: DomainTransaction,
  boardId: string,
  columnId: string,
  anchorId: string,
): Promise<number> {
  const [anchor] = await transaction<{ position: number }[]>`
    SELECT position::float8 AS position
    FROM tasks
    WHERE id = ${anchorId}
      AND board_id = ${boardId}
      AND column_id = ${columnId}
      AND archived_at IS NULL
    FOR SHARE
  `;
  if (!anchor) {
    throw new DomainError(422, "INVALID_MOVE_ANCHOR", "La tarea de referencia no está en la columna de destino.");
  }
  return anchor.position;
}

async function rebalanceColumn(
  transaction: DomainTransaction,
  context: WorkspaceContext,
  boardId: string,
  columnId: string,
  excludedTaskId: string,
): Promise<void> {
  const rebalanced = await transaction<{ id: string }[]>`
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY position, created_at, id) * 1000 AS new_position
      FROM tasks
      WHERE column_id = ${columnId}
        AND archived_at IS NULL
        AND id <> ${excludedTaskId}
    )
    UPDATE tasks t
    SET position = ranked.new_position, version = t.version + 1
    FROM ranked
    WHERE t.id = ranked.id
    RETURNING t.id
  `;
  await recordActivity(transaction, context, {
    boardId,
    entityType: "board_column",
    entityId: columnId,
    action: "board.column_rebalanced",
    summary: "Se normalizó el orden interno de una columna.",
    metadata: { affectedTasks: rebalanced.length },
  });
}

async function resolveMovePosition(
  transaction: DomainTransaction,
  context: WorkspaceContext,
  task: LockedTask,
  toColumnId: string,
  input: Pick<MoveTaskInput, "position" | "beforeTaskId" | "afterTaskId">,
  mayRebalance = true,
): Promise<number> {
  if (input.position !== undefined) return input.position;
  if (!input.beforeTaskId && !input.afterTaskId) {
    return getLastPosition(transaction, toColumnId, task.id);
  }

  const before = input.beforeTaskId
    ? await readAnchor(transaction, task.boardId, toColumnId, input.beforeTaskId)
    : null;
  const after = input.afterTaskId
    ? await readAnchor(transaction, task.boardId, toColumnId, input.afterTaskId)
    : null;

  let lower = after;
  let upper = before;
  if (before !== null && after === null) {
    const [row] = await transaction<{ position: number | null }[]>`
      SELECT MAX(position)::float8 AS position
      FROM tasks
      WHERE column_id = ${toColumnId}
        AND archived_at IS NULL
        AND id <> ${task.id}
        AND position < ${before}
    `;
    lower = row?.position ?? null;
  }
  if (after !== null && before === null) {
    const [row] = await transaction<{ position: number | null }[]>`
      SELECT MIN(position)::float8 AS position
      FROM tasks
      WHERE column_id = ${toColumnId}
        AND archived_at IS NULL
        AND id <> ${task.id}
        AND position > ${after}
    `;
    upper = row?.position ?? null;
  }

  if (lower !== null && upper !== null && lower >= upper) {
    throw new DomainError(422, "INVALID_MOVE_ORDER", "Las tareas de referencia no describen un orden válido.");
  }
  if (lower === null && upper !== null) return upper - 1_000;
  if (lower !== null && upper === null) return lower + 1_000;
  if (lower === null || upper === null) return 1_000;

  if (upper - lower < 0.001 && mayRebalance) {
    await rebalanceColumn(transaction, context, task.boardId, toColumnId, task.id);
    return resolveMovePosition(transaction, context, task, toColumnId, input, false);
  }
  return (lower + upper) / 2;
}

function ensureEffectiveDateRange(
  current: LockedTask,
  input: Pick<UpdateTaskInput, "startDate" | "dueDate">,
): void {
  const startDate = input.startDate !== undefined ? input.startDate : current.startDate;
  const dueDate = input.dueDate !== undefined ? input.dueDate : current.dueDate;
  if (startDate && dueDate && dueDate < startDate) {
    throw new DomainError(422, "INVALID_DATE_RANGE", "La fecha de vencimiento no puede ser anterior al inicio.");
  }
}

export async function createTask(
  context: WorkspaceContext,
  rawInput: CreateTaskInput,
): Promise<TaskMutationResult> {
  const input = parseDomainInput(createTaskSchema, rawInput);
  const sql = db();

  try {
    return await sql.begin(async (transaction) => {
      await lockWorkspaceForTaskMutation(transaction, context);
      const actor = await requireWorkspaceAccess(transaction, context, TASK_WRITE_ACCESS);
      const [board] = await transaction<{
        id: string;
        taskNumber: number;
        visibility: "WORKSPACE" | "PRIVATE";
      }[]>`
        UPDATE boards
        SET next_task_number = next_task_number + 1
        WHERE id = ${input.boardId}
          AND workspace_id = ${context.workspaceId}
          AND archived_at IS NULL
        RETURNING id, next_task_number - 1 AS "taskNumber", visibility
      `;
      if (!board) throw new DomainError(404, "BOARD_NOT_FOUND", "El tablero no existe en este espacio de trabajo.");
      await requireBoardWriteAccess(
        transaction,
        context,
        actor.accessLevel,
        board.id,
        board.visibility,
      );

      const [column] = await transaction<LockedColumn[]>`
        SELECT id, board_id AS "boardId", category, wip_limit AS "wipLimit"
        FROM board_columns
        WHERE id = ${input.columnId} AND board_id = ${board.id}
        FOR UPDATE
      `;
      if (!column) throw new DomainError(422, "INVALID_COLUMN", "La columna no pertenece al tablero.");

      await assertWipAvailable(transaction, column);
      await ensureSprint(transaction, context, input.sprintId, board.id);
      await ensureParentTask(transaction, context, input.parentTaskId, board.id);
      await ensureMemberships(transaction, context, input.assigneeIds);
      await ensureLabels(transaction, context, input.labelIds);

      const position = input.position ?? (await getLastPosition(transaction, column.id));
      const [created] = await transaction<{ id: string }[]>`
        INSERT INTO tasks (
          board_id,
          column_id,
          sprint_id,
          parent_task_id,
          task_number,
          title,
          description,
          task_type,
          priority,
          position,
          story_points,
          estimate_minutes,
          start_date,
          due_date,
          completed_at,
          reporter_id
        ) VALUES (
          ${board.id},
          ${column.id},
          ${input.sprintId},
          ${input.parentTaskId},
          ${board.taskNumber},
          ${input.title},
          ${input.description},
          ${input.taskType},
          ${input.priority},
          ${position},
          ${input.storyPoints},
          ${input.estimateMinutes},
          ${input.startDate},
          ${input.dueDate},
          ${column.category === "DONE" ? new Date() : null},
          ${actor.membershipId}
        )
        RETURNING id
      `;
      if (!created) throw new DomainError(500, "TASK_CREATE_FAILED", "No fue posible crear la tarea.");
      const task = await readTaskResult(transaction, created.id);

      await replaceAssignees(transaction, task.id, input.assigneeIds);
      await replaceLabels(transaction, task.id, input.labelIds);
      await transaction`
        INSERT INTO task_transitions (
          task_id,
          to_column_id,
          to_sprint_id,
          actor_id,
          event_type,
          story_points_at_event
        ) VALUES (
          ${task.id},
          ${task.columnId},
          ${task.sprintId},
          ${actor.membershipId},
          'CREATED',
          ${task.storyPoints}
        )
      `;
      if (column.category === "DONE") {
        await transaction`
          INSERT INTO task_transitions (
            task_id, from_column_id, to_column_id, from_sprint_id, to_sprint_id,
            actor_id, event_type, story_points_at_event
          ) VALUES (
            ${task.id}, ${task.columnId}, ${task.columnId}, ${task.sprintId}, ${task.sprintId},
            ${actor.membershipId}, 'COMPLETED', ${task.storyPoints}
          )
        `;
      }

      await recordActivity(transaction, context, {
        boardId: task.boardId,
        entityType: "task",
        entityId: task.id,
        action: "task.created",
        summary: `Se creó la tarea «${task.title}».`,
        metadata: { boardId: task.boardId, columnId: task.columnId, taskNumber: task.taskNumber },
      });
      return task;
    });
  } catch (error) {
    rethrowDatabaseError(error, "TASK_CONFLICT", "No fue posible crear la tarea por un conflicto de datos.");
  }
}

export async function updateTask(
  context: WorkspaceContext,
  rawInput: UpdateTaskInput,
): Promise<TaskMutationResult> {
  const input = parseDomainInput(updateTaskSchema, rawInput);
  const sql = db();

  try {
    return await sql.begin(async (transaction) => {
      await lockWorkspaceForTaskMutation(transaction, context);
      const actor = await requireWorkspaceAccess(transaction, context, TASK_WRITE_ACCESS);
      if (input.parentTaskId !== undefined) {
        await lockTaskBoardForHierarchyChange(transaction, context, input.taskId);
      }
      const current = await lockTask(transaction, context, input.taskId, actor.accessLevel);
      assertVersion(current.version, input.expectedVersion);
      assertTaskSprintMutable(current);
      ensureEffectiveDateRange(current, input);

      if (input.parentTaskId !== undefined) {
        await ensureParentTask(transaction, context, input.parentTaskId, current.boardId, current.id);
      }
      if (input.sprintId !== undefined && input.sprintId !== current.sprintId) {
        await ensureSprint(transaction, context, input.sprintId, current.boardId);
      }
      if (input.assigneeIds !== undefined) {
        await ensureMemberships(transaction, context, input.assigneeIds);
      }
      if (input.labelIds !== undefined) {
        await ensureLabels(transaction, context, input.labelIds);
      }

      const [updated] = await transaction<{ id: string }[]>`
        UPDATE tasks
        SET
          title = CASE WHEN ${input.title !== undefined} THEN ${input.title ?? ""} ELSE title END,
          description = CASE WHEN ${input.description !== undefined} THEN ${input.description ?? ""} ELSE description END,
          task_type = CASE WHEN ${input.taskType !== undefined} THEN ${input.taskType ?? "TASK"} ELSE task_type END,
          priority = CASE WHEN ${input.priority !== undefined} THEN ${input.priority ?? "MEDIUM"} ELSE priority END,
          story_points = CASE WHEN ${input.storyPoints !== undefined} THEN ${input.storyPoints ?? null} ELSE story_points END,
          estimate_minutes = CASE WHEN ${input.estimateMinutes !== undefined} THEN ${input.estimateMinutes ?? null} ELSE estimate_minutes END,
          start_date = CASE WHEN ${input.startDate !== undefined} THEN ${input.startDate ?? null} ELSE start_date END,
          due_date = CASE WHEN ${input.dueDate !== undefined} THEN ${input.dueDate ?? null} ELSE due_date END,
          sprint_id = CASE WHEN ${input.sprintId !== undefined} THEN ${input.sprintId ?? null} ELSE sprint_id END,
          parent_task_id = CASE WHEN ${input.parentTaskId !== undefined} THEN ${input.parentTaskId ?? null} ELSE parent_task_id END,
          version = version + 1
        WHERE id = ${current.id}
          AND version = ${input.expectedVersion}
        RETURNING id
      `;
      if (!updated) throw new DomainError(409, "VERSION_CONFLICT", "La tarea fue modificada por otra operación.");
      const task = await readTaskResult(transaction, updated.id);

      if (input.assigneeIds !== undefined) await replaceAssignees(transaction, task.id, input.assigneeIds);
      if (input.labelIds !== undefined) await replaceLabels(transaction, task.id, input.labelIds);

      if (input.storyPoints !== undefined && input.storyPoints !== current.storyPoints) {
        await transaction`
          INSERT INTO task_transitions (
            task_id, from_column_id, to_column_id, from_sprint_id, to_sprint_id,
            actor_id, event_type, previous_story_points, story_points_at_event, metadata
          ) VALUES (
            ${task.id}, ${task.columnId}, ${task.columnId}, ${current.sprintId}, ${current.sprintId},
            ${actor.membershipId}, 'ESTIMATE_CHANGED', ${current.storyPoints}, ${task.storyPoints},
            ${transaction.json({ version: task.version })}
          )
        `;
        await recordActivity(transaction, context, {
          boardId: task.boardId,
          entityType: "task",
          entityId: task.id,
          action: "task.story_points_changed",
          summary: `Se modificó la estimación de la tarea «${task.title}».`,
          metadata: {
            fromStoryPoints: current.storyPoints,
            toStoryPoints: task.storyPoints,
            sprintId: current.sprintId,
            version: task.version,
          },
        });
      }

      if (input.sprintId !== undefined && task.sprintId !== current.sprintId) {
        await transaction`
          INSERT INTO task_transitions (
            task_id, from_column_id, to_column_id, from_sprint_id, to_sprint_id,
            actor_id, event_type, story_points_at_event
          ) VALUES (
            ${task.id}, ${task.columnId}, ${task.columnId}, ${current.sprintId}, ${task.sprintId},
            ${actor.membershipId}, 'SPRINT_CHANGED', ${task.storyPoints}
          )
        `;
        await recordActivity(transaction, context, {
          boardId: task.boardId,
          entityType: "task",
          entityId: task.id,
          action: "task.sprint_changed",
          summary: task.sprintId
            ? `Se asignó la tarea «${task.title}» a un sprint.`
            : `Se devolvió la tarea «${task.title}» al backlog.`,
          metadata: {
            fromSprintId: current.sprintId,
            toSprintId: task.sprintId,
            version: task.version,
          },
        });
      }

      const changedFields = Object.entries(input)
        .filter(([key, value]) => !["taskId", "expectedVersion"].includes(key) && value !== undefined)
        .map(([key]) => key)
        .join(",");
      await recordActivity(transaction, context, {
        boardId: task.boardId,
        entityType: "task",
        entityId: task.id,
        action: "task.updated",
        summary: `Se actualizó la tarea «${task.title}».`,
        metadata: { version: task.version, changedFields },
      });
      return task;
    });
  } catch (error) {
    rethrowDatabaseError(error, "TASK_CONFLICT", "No fue posible actualizar la tarea por un conflicto de datos.");
  }
}

export async function archiveTask(
  context: WorkspaceContext,
  rawInput: ArchiveTaskInput,
): Promise<TaskMutationResult> {
  const input = parseDomainInput(archiveTaskSchema, rawInput);
  const sql = db();

  try {
    return await sql.begin(async (transaction) => {
      await lockWorkspaceForTaskMutation(transaction, context);
      const actor = await requireWorkspaceAccess(transaction, context, MANAGE_ACCESS);
      const current = await lockTask(transaction, context, input.taskId, actor.accessLevel);
      assertVersion(current.version, input.expectedVersion);
      assertTaskSprintMutable(current);

    const [archived] = await transaction<{ id: string }[]>`
      UPDATE tasks
      SET archived_at = NOW(), version = version + 1
      WHERE id = ${current.id} AND version = ${input.expectedVersion}
      RETURNING id
    `;
    if (!archived) throw new DomainError(409, "VERSION_CONFLICT", "La tarea fue modificada por otra operación.");
    const task = await readTaskResult(transaction, archived.id);

    await transaction`
      INSERT INTO task_transitions (
        task_id, from_column_id, to_column_id, from_sprint_id, to_sprint_id,
        actor_id, event_type, story_points_at_event
      ) VALUES (
        ${task.id}, ${current.columnId}, ${current.columnId}, ${current.sprintId}, ${current.sprintId},
        ${actor.membershipId}, 'ARCHIVED', ${task.storyPoints}
      )
    `;
    await recordActivity(transaction, context, {
      boardId: task.boardId,
      entityType: "task",
      entityId: task.id,
      action: "task.archived",
      summary: `Se archivó la tarea «${task.title}».`,
      metadata: { version: task.version },
    });
      return task;
    });
  } catch (error) {
    rethrowDatabaseError(error, "TASK_CONFLICT", "No fue posible archivar la tarea por un conflicto de datos.");
  }
}

export async function moveTask(
  context: WorkspaceContext,
  rawInput: MoveTaskInput,
): Promise<TaskMutationResult> {
  const input = parseDomainInput(moveTaskSchema, rawInput);
  const sql = db();

  try {
    return await sql.begin(async (transaction) => {
      await lockWorkspaceForTaskMutation(transaction, context);
      const actor = await requireWorkspaceAccess(transaction, context, TASK_WRITE_ACCESS);
      const current = await lockTask(transaction, context, input.taskId, actor.accessLevel);
      assertVersion(current.version, input.expectedVersion);
      assertTaskSprintMutable(current);

    const columnIds = [...new Set([current.columnId, input.toColumnId])].sort();
    const columns = await transaction<LockedColumn[]>`
      SELECT id, board_id AS "boardId", category, wip_limit AS "wipLimit"
      FROM board_columns
      WHERE board_id = ${current.boardId}
        AND id IN (
          SELECT value::uuid
          FROM jsonb_array_elements_text(${transaction.json(columnIds)}::jsonb)
        )
      ORDER BY id
      FOR UPDATE
    `;
    const sourceColumn = columns.find((column) => column.id === current.columnId);
    const targetColumn = columns.find((column) => column.id === input.toColumnId);
    if (!sourceColumn || !targetColumn) {
      throw new DomainError(422, "INVALID_COLUMN", "La columna de destino no pertenece al tablero.");
    }

    if (sourceColumn.id !== targetColumn.id) {
      await assertWipAvailable(transaction, targetColumn, current.id);
    }
    const position = await resolveMovePosition(transaction, context, current, targetColumn.id, input);
    const enteringDone = sourceColumn.category !== "DONE" && targetColumn.category === "DONE";
    const leavingDone = sourceColumn.category === "DONE" && targetColumn.category !== "DONE";
    const eventType = enteringDone ? "COMPLETED" : leavingDone ? "REOPENED" : "MOVED";

    const [moved] = await transaction<{ id: string }[]>`
      UPDATE tasks
      SET
        column_id = ${targetColumn.id},
        position = ${position},
        completed_at = CASE
          WHEN ${targetColumn.category === "DONE"} THEN COALESCE(completed_at, NOW())
          ELSE NULL
        END,
        version = version + 1
      WHERE id = ${current.id}
        AND version = ${input.expectedVersion}
      RETURNING id
    `;
    if (!moved) throw new DomainError(409, "VERSION_CONFLICT", "La tarea fue modificada por otra operación.");
    const task = await readTaskResult(transaction, moved.id);

    await transaction`
      INSERT INTO task_transitions (
        task_id, from_column_id, to_column_id, from_sprint_id, to_sprint_id,
        actor_id, event_type, story_points_at_event
      ) VALUES (
        ${task.id}, ${sourceColumn.id}, ${targetColumn.id}, ${task.sprintId}, ${task.sprintId},
        ${actor.membershipId}, ${eventType}, ${task.storyPoints}
      )
    `;
    await recordActivity(transaction, context, {
      boardId: task.boardId,
      entityType: "task",
      entityId: task.id,
      action: `task.${eventType.toLowerCase()}`,
      summary:
        eventType === "COMPLETED"
          ? `Se completó la tarea «${task.title}».`
          : eventType === "REOPENED"
            ? `Se reabrió la tarea «${task.title}».`
            : `Se movió la tarea «${task.title}».`,
      metadata: {
        fromColumnId: sourceColumn.id,
        toColumnId: targetColumn.id,
        version: task.version,
      },
    });
      return task;
    });
  } catch (error) {
    rethrowDatabaseError(error, "TASK_CONFLICT", "No fue posible mover la tarea por un conflicto de datos.");
  }
}

export async function createComment(
  context: WorkspaceContext,
  rawInput: CreateCommentInput,
): Promise<CommentMutationResult> {
  const input = parseDomainInput(createCommentSchema, rawInput);
  const sql = db();

  return sql.begin(async (transaction) => {
    const actor = await requireWorkspaceAccess(transaction, context, TASK_WRITE_ACCESS);
    const task = await lockTask(transaction, context, input.taskId, actor.accessLevel);
    const [comment] = await transaction<CommentMutationResult[]>`
      INSERT INTO comments (task_id, author_id, body)
      VALUES (${task.id}, ${actor.membershipId}, ${input.body})
      RETURNING
        id,
        task_id AS "taskId",
        author_id AS "authorId",
        body,
        edited_at::text AS "editedAt",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
    `;
    if (!comment) throw new DomainError(500, "COMMENT_CREATE_FAILED", "No fue posible añadir el comentario.");

    await recordActivity(transaction, context, {
      boardId: task.boardId,
      entityType: "comment",
      entityId: comment.id,
      action: "task.comment_created",
      summary: `Se añadió un comentario a «${task.title}».`,
      metadata: { taskId: task.id },
    });
    return comment;
  });
}

export async function updateComment(
  context: WorkspaceContext,
  rawInput: UpdateCommentInput,
): Promise<CommentMutationResult> {
  const input = parseDomainInput(updateCommentSchema, rawInput);
  const sql = db();

  return sql.begin(async (transaction) => {
    const actor = await requireWorkspaceAccess(transaction, context, TASK_WRITE_ACCESS);
    const [current] = await transaction<{
      id: string;
      boardId: string;
      taskId: string;
      taskTitle: string;
      authorId: string | null;
      visibility: "WORKSPACE" | "PRIVATE";
    }[]>`
      SELECT
        co.id,
        t.board_id AS "boardId",
        co.task_id AS "taskId",
        t.title AS "taskTitle",
        co.author_id AS "authorId",
        b.visibility
      FROM comments co
      JOIN tasks t ON t.id = co.task_id
      JOIN boards b ON b.id = t.board_id
      WHERE co.id = ${input.commentId}
        AND b.workspace_id = ${context.workspaceId}
        AND b.archived_at IS NULL
        AND t.archived_at IS NULL
        AND co.deleted_at IS NULL
      FOR UPDATE OF co
      FOR SHARE OF t
    `;
    if (!current) throw new DomainError(404, "COMMENT_NOT_FOUND", "El comentario no existe.");
    await requireBoardWriteAccess(
      transaction,
      context,
      actor.accessLevel,
      current.boardId,
      current.visibility,
    );
    if (current.authorId !== actor.membershipId) {
      throw new DomainError(403, "COMMENT_EDIT_DENIED", "Solo el autor puede editar el comentario.");
    }

    const [comment] = await transaction<CommentMutationResult[]>`
      UPDATE comments
      SET body = ${input.body}, edited_at = NOW()
      WHERE id = ${current.id}
      RETURNING
        id,
        task_id AS "taskId",
        author_id AS "authorId",
        body,
        edited_at::text AS "editedAt",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
    `;
    if (!comment) throw new DomainError(500, "COMMENT_UPDATE_FAILED", "No fue posible editar el comentario.");
    await recordActivity(transaction, context, {
      boardId: current.boardId,
      entityType: "comment",
      entityId: comment.id,
      action: "task.comment_updated",
      summary: `Se editó un comentario de «${current.taskTitle}».`,
      metadata: { taskId: current.taskId },
    });
    return comment;
  });
}

export async function deleteComment(
  context: WorkspaceContext,
  rawInput: DeleteCommentInput,
): Promise<{ id: string }> {
  const input = parseDomainInput(deleteCommentSchema, rawInput);
  const sql = db();

  return sql.begin(async (transaction) => {
    const actor = await requireWorkspaceAccess(transaction, context, TASK_WRITE_ACCESS);
    const [current] = await transaction<{
      id: string;
      boardId: string;
      taskId: string;
      taskTitle: string;
      authorId: string | null;
      visibility: "WORKSPACE" | "PRIVATE";
    }[]>`
      SELECT
        co.id,
        t.board_id AS "boardId",
        co.task_id AS "taskId",
        t.title AS "taskTitle",
        co.author_id AS "authorId",
        b.visibility
      FROM comments co
      JOIN tasks t ON t.id = co.task_id
      JOIN boards b ON b.id = t.board_id
      WHERE co.id = ${input.commentId}
        AND b.workspace_id = ${context.workspaceId}
        AND b.archived_at IS NULL
        AND t.archived_at IS NULL
        AND co.deleted_at IS NULL
      FOR UPDATE OF co
      FOR SHARE OF t
    `;
    if (!current) throw new DomainError(404, "COMMENT_NOT_FOUND", "El comentario no existe.");
    await requireBoardWriteAccess(
      transaction,
      context,
      actor.accessLevel,
      current.boardId,
      current.visibility,
    );
    if (
      current.authorId !== actor.membershipId &&
      actor.accessLevel !== "OWNER" &&
      actor.accessLevel !== "ADMIN"
    ) {
      throw new DomainError(403, "COMMENT_DELETE_DENIED", "Solo el autor o un administrador puede eliminar el comentario.");
    }

    await transaction`
      UPDATE comments
      SET deleted_at = NOW(), deleted_by = ${actor.membershipId}
      WHERE id = ${current.id} AND deleted_at IS NULL
    `;
    await recordActivity(transaction, context, {
      boardId: current.boardId,
      entityType: "comment",
      entityId: current.id,
      action: "task.comment_deleted",
      summary: `Se eliminó un comentario de «${current.taskTitle}».`,
      metadata: {
        taskId: current.taskId,
        authorId: current.authorId,
        deletedByAuthor: current.authorId === actor.membershipId,
      },
    });
    return { id: current.id };
  });
}

export async function createChecklist(
  context: WorkspaceContext,
  rawInput: CreateChecklistInput,
): Promise<ChecklistMutationResult> {
  const input = parseDomainInput(createChecklistSchema, rawInput);
  const sql = db();

  return sql.begin(async (transaction) => {
    const actor = await requireWorkspaceAccess(transaction, context, TASK_WRITE_ACCESS);
    const task = await lockTask(transaction, context, input.taskId, actor.accessLevel);
    const [order] = await transaction<{ position: number }[]>`
      SELECT (COALESCE(MAX(position), 0) + 1000)::float8 AS position
      FROM checklists
      WHERE task_id = ${task.id}
    `;
    const [checklist] = await transaction<ChecklistMutationResult[]>`
      INSERT INTO checklists (task_id, title, position)
      VALUES (${task.id}, ${input.title}, ${input.position ?? order?.position ?? 1_000})
      RETURNING
        id,
        task_id AS "taskId",
        title,
        position::float8 AS position,
        created_at::text AS "createdAt"
    `;
    if (!checklist) throw new DomainError(500, "CHECKLIST_CREATE_FAILED", "No fue posible crear el checklist.");
    await recordActivity(transaction, context, {
      boardId: task.boardId,
      entityType: "checklist",
      entityId: checklist.id,
      action: "task.checklist_created",
      summary: `Se añadió un checklist a «${task.title}».`,
      metadata: { taskId: task.id },
    });
    return checklist;
  });
}

export async function createChecklistItem(
  context: WorkspaceContext,
  rawInput: CreateChecklistItemInput,
): Promise<ChecklistItemMutationResult> {
  const input = parseDomainInput(createChecklistItemSchema, rawInput);
  const sql = db();

  return sql.begin(async (transaction) => {
    const actor = await requireWorkspaceAccess(transaction, context, TASK_WRITE_ACCESS);
    const [checklist] = await transaction<{
      id: string;
      boardId: string;
      taskId: string;
      taskTitle: string;
      visibility: "WORKSPACE" | "PRIVATE";
    }[]>`
      SELECT
        cl.id,
        t.board_id AS "boardId",
        cl.task_id AS "taskId",
        t.title AS "taskTitle",
        b.visibility
      FROM checklists cl
      JOIN tasks t ON t.id = cl.task_id
      JOIN boards b ON b.id = t.board_id
      WHERE cl.id = ${input.checklistId}
        AND b.workspace_id = ${context.workspaceId}
        AND b.archived_at IS NULL
        AND t.archived_at IS NULL
      FOR UPDATE OF cl
      FOR SHARE OF t
    `;
    if (!checklist) throw new DomainError(404, "CHECKLIST_NOT_FOUND", "El checklist no existe.");
    await requireBoardWriteAccess(
      transaction,
      context,
      actor.accessLevel,
      checklist.boardId,
      checklist.visibility,
    );
    const [order] = await transaction<{ position: number }[]>`
      SELECT (COALESCE(MAX(position), 0) + 1000)::float8 AS position
      FROM checklist_items
      WHERE checklist_id = ${checklist.id}
    `;
    const [item] = await transaction<ChecklistItemMutationResult[]>`
      INSERT INTO checklist_items (checklist_id, content, position)
      VALUES (${checklist.id}, ${input.content}, ${input.position ?? order?.position ?? 1_000})
      RETURNING
        id,
        checklist_id AS "checklistId",
        content,
        is_complete AS "isComplete",
        position::float8 AS position,
        completed_by AS "completedBy",
        completed_at::text AS "completedAt",
        updated_at::text AS "updatedAt"
    `;
    if (!item) throw new DomainError(500, "CHECKLIST_ITEM_CREATE_FAILED", "No fue posible crear el elemento.");
    await recordActivity(transaction, context, {
      boardId: checklist.boardId,
      entityType: "checklist_item",
      entityId: item.id,
      action: "task.checklist_item_created",
      summary: `Se añadió un elemento al checklist de «${checklist.taskTitle}».`,
      metadata: { taskId: checklist.taskId, checklistId: checklist.id },
    });
    return item;
  });
}

export async function updateChecklistItem(
  context: WorkspaceContext,
  rawInput: UpdateChecklistItemInput,
): Promise<ChecklistItemMutationResult> {
  const input = parseDomainInput(updateChecklistItemSchema, rawInput);
  const sql = db();

  return sql.begin(async (transaction) => {
    const actor = await requireWorkspaceAccess(transaction, context, TASK_WRITE_ACCESS);
    const [current] = await transaction<{
      id: string;
      boardId: string;
      checklistId: string;
      taskId: string;
      taskTitle: string;
      isComplete: boolean;
      visibility: "WORKSPACE" | "PRIVATE";
    }[]>`
      SELECT
        ci.id,
        t.board_id AS "boardId",
        ci.checklist_id AS "checklistId",
        cl.task_id AS "taskId",
        t.title AS "taskTitle",
        ci.is_complete AS "isComplete",
        b.visibility
      FROM checklist_items ci
      JOIN checklists cl ON cl.id = ci.checklist_id
      JOIN tasks t ON t.id = cl.task_id
      JOIN boards b ON b.id = t.board_id
      WHERE ci.id = ${input.itemId}
        AND b.workspace_id = ${context.workspaceId}
        AND b.archived_at IS NULL
        AND t.archived_at IS NULL
      FOR UPDATE OF ci
      FOR SHARE OF t
    `;
    if (!current) throw new DomainError(404, "CHECKLIST_ITEM_NOT_FOUND", "El elemento no existe.");
    await requireBoardWriteAccess(
      transaction,
      context,
      actor.accessLevel,
      current.boardId,
      current.visibility,
    );

    const [item] = await transaction<ChecklistItemMutationResult[]>`
      UPDATE checklist_items
      SET
        content = CASE WHEN ${input.content !== undefined} THEN ${input.content ?? ""} ELSE content END,
        is_complete = CASE WHEN ${input.isComplete !== undefined} THEN ${input.isComplete ?? false} ELSE is_complete END,
        position = CASE WHEN ${input.position !== undefined} THEN ${input.position ?? 0} ELSE position END,
        completed_by = CASE
          WHEN ${input.isComplete === true} AND NOT is_complete THEN ${actor.membershipId}
          WHEN ${input.isComplete === false} THEN NULL
          ELSE completed_by
        END,
        completed_at = CASE
          WHEN ${input.isComplete === true} AND NOT is_complete THEN NOW()
          WHEN ${input.isComplete === false} THEN NULL
          ELSE completed_at
        END
      WHERE id = ${current.id}
      RETURNING
        id,
        checklist_id AS "checklistId",
        content,
        is_complete AS "isComplete",
        position::float8 AS position,
        completed_by AS "completedBy",
        completed_at::text AS "completedAt",
        updated_at::text AS "updatedAt"
    `;
    if (!item) throw new DomainError(500, "CHECKLIST_ITEM_UPDATE_FAILED", "No fue posible actualizar el elemento.");
    await recordActivity(transaction, context, {
      boardId: current.boardId,
      entityType: "checklist_item",
      entityId: item.id,
      action: "task.checklist_item_updated",
      summary: `Se actualizó un elemento del checklist de «${current.taskTitle}».`,
      metadata: {
        taskId: current.taskId,
        checklistId: current.checklistId,
        isComplete: item.isComplete,
      },
    });
    return item;
  });
}
