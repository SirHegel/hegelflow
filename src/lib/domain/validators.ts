import { z } from "zod";

import type {
  AccessLevel,
  ColumnCategory,
  SprintStatus,
  TaskPriority,
  TaskType,
} from "@/lib/types";

export class DomainError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "DomainError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const accessLevels = ["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const satisfies readonly AccessLevel[];
const taskTypes = ["EPIC", "STORY", "TASK", "BUG"] as const satisfies readonly TaskType[];
const taskPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const satisfies readonly TaskPriority[];
const columnCategories = ["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const satisfies readonly ColumnCategory[];
const sprintStatuses = ["PLANNED", "ACTIVE", "COMPLETED", "CANCELLED"] as const satisfies readonly SprintStatus[];

export const uuidSchema = z.string().uuid();
export const accessLevelSchema = z.enum(accessLevels);
export const taskTypeSchema = z.enum(taskTypes);
export const taskPrioritySchema = z.enum(taskPriorities);
export const columnCategorySchema = z.enum(columnCategories);
export const sprintStatusSchema = z.enum(sprintStatuses);

const dateSchema = z
  .string()
  .regex(/^(?!0000)\d{4}-\d{2}-\d{2}$/, "La fecha debe usar el formato YYYY-MM-DD y un año válido.")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "La fecha no es válida.");

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "El slug solo puede contener letras, números y guiones simples.");

const colorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "El color debe estar en formato hexadecimal de seis dígitos.")
  .transform((value) => value.toLowerCase());

const positionSchema = z
  .number()
  .finite()
  .min(-99_999_999.9999)
  .max(99_999_999.9999)
  .multipleOf(0.0001);
const nullableDateSchema = dateSchema.nullable();
const idListSchema = z
  .array(uuidSchema)
  .max(100)
  .refine((ids) => new Set(ids).size === ids.length, "No se permiten identificadores repetidos.");

function validateDateRange(
  input: { startDate?: string | null; dueDate?: string | null; endDate?: string | null },
  context: z.RefinementCtx,
) {
  const end = input.dueDate ?? input.endDate;
  if (input.startDate && end && end < input.startDate) {
    context.addIssue({
      code: "custom",
      message: "La fecha final no puede ser anterior a la fecha inicial.",
      path: [input.dueDate !== undefined ? "dueDate" : "endDate"],
    });
  }
}

export const taskPlacementSchema = z
  .strictObject({
    position: positionSchema.optional(),
    beforeTaskId: uuidSchema.nullable().optional(),
    afterTaskId: uuidSchema.nullable().optional(),
  })
  .superRefine((input, context) => {
    const hasPosition = input.position !== undefined;
    const hasAnchor = Boolean(input.beforeTaskId || input.afterTaskId);
    if (hasPosition && hasAnchor) {
      context.addIssue({
        code: "custom",
        message: "Use una posición directa o tareas de referencia, no ambas.",
      });
    }
    if (input.beforeTaskId && input.beforeTaskId === input.afterTaskId) {
      context.addIssue({
        code: "custom",
        message: "Las referencias anterior y posterior deben ser distintas.",
      });
    }
  });

const taskEditableFields = {
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(100_000),
  taskType: taskTypeSchema,
  priority: taskPrioritySchema,
  storyPoints: z.number().int().min(0).max(10_000).nullable(),
  estimateMinutes: z.number().int().min(0).max(5_256_000).nullable(),
  startDate: nullableDateSchema,
  dueDate: nullableDateSchema,
  parentTaskId: uuidSchema.nullable(),
  assigneeIds: idListSchema,
  labelIds: idListSchema,
};

export const createTaskSchema = z
  .strictObject({
    boardId: uuidSchema,
    columnId: uuidSchema,
    sprintId: uuidSchema.nullable().default(null),
    title: taskEditableFields.title,
    description: taskEditableFields.description.default(""),
    taskType: taskTypeSchema.default("TASK"),
    priority: taskPrioritySchema.default("MEDIUM"),
    position: positionSchema.optional(),
    storyPoints: taskEditableFields.storyPoints.default(null),
    estimateMinutes: taskEditableFields.estimateMinutes.default(null),
    startDate: nullableDateSchema.default(null),
    dueDate: nullableDateSchema.default(null),
    parentTaskId: uuidSchema.nullable().default(null),
    assigneeIds: idListSchema.default([]),
    labelIds: idListSchema.default([]),
  })
  .superRefine(validateDateRange);

export const updateTaskSchema = z
  .strictObject({
    taskId: uuidSchema,
    expectedVersion: z.number().int().positive(),
    title: taskEditableFields.title.optional(),
    description: taskEditableFields.description.optional(),
    taskType: taskEditableFields.taskType.optional(),
    priority: taskEditableFields.priority.optional(),
    storyPoints: taskEditableFields.storyPoints.optional(),
    estimateMinutes: taskEditableFields.estimateMinutes.optional(),
    startDate: taskEditableFields.startDate.optional(),
    dueDate: taskEditableFields.dueDate.optional(),
    sprintId: uuidSchema.nullable().optional(),
    parentTaskId: taskEditableFields.parentTaskId.optional(),
    assigneeIds: taskEditableFields.assigneeIds.optional(),
    labelIds: taskEditableFields.labelIds.optional(),
  })
  .superRefine((input, context) => {
    validateDateRange(input, context);
    const editableKeys = Object.keys(taskEditableFields) as (keyof typeof taskEditableFields)[];
    if (!editableKeys.some((key) => input[key] !== undefined) && input.sprintId === undefined) {
      context.addIssue({ code: "custom", message: "Debe indicar al menos un campo para editar." });
    }
  });

export const archiveTaskSchema = z.strictObject({
  taskId: uuidSchema,
  expectedVersion: z.number().int().positive(),
});

export const moveTaskSchema = z
  .strictObject({
    taskId: uuidSchema,
    toColumnId: uuidSchema,
    expectedVersion: z.number().int().positive(),
    position: positionSchema.optional(),
    beforeTaskId: uuidSchema.nullable().optional(),
    afterTaskId: uuidSchema.nullable().optional(),
  })
  .superRefine((input, context) => {
    const placement = taskPlacementSchema.safeParse({
      position: input.position,
      beforeTaskId: input.beforeTaskId,
      afterTaskId: input.afterTaskId,
    });
    if (!placement.success) {
      context.addIssue({
        code: "custom",
        message: placement.error.issues.map((issue) => issue.message).join(" "),
      });
    }
    if (input.beforeTaskId === input.taskId || input.afterTaskId === input.taskId) {
      context.addIssue({ code: "custom", message: "Una tarea no puede usarse como su propia referencia." });
    }
  });

export const createCommentSchema = z.strictObject({
  taskId: uuidSchema,
  body: z.string().trim().min(1).max(10_000),
});

export const updateCommentSchema = z.strictObject({
  commentId: uuidSchema,
  body: z.string().trim().min(1).max(10_000),
});

export const deleteCommentSchema = z.strictObject({ commentId: uuidSchema });

export const createChecklistSchema = z.strictObject({
  taskId: uuidSchema,
  title: z.string().trim().min(1).max(120).default("Checklist"),
  position: positionSchema.optional(),
});

export const createChecklistItemSchema = z.strictObject({
  checklistId: uuidSchema,
  content: z.string().trim().min(1).max(400),
  position: positionSchema.optional(),
});

export const updateChecklistItemSchema = z
  .strictObject({
    itemId: uuidSchema,
    content: z.string().trim().min(1).max(400).optional(),
    isComplete: z.boolean().optional(),
    position: positionSchema.optional(),
  })
  .refine(
    (input) => input.content !== undefined || input.isComplete !== undefined || input.position !== undefined,
    "Debe indicar al menos un cambio para el elemento.",
  );

export const boardColumnInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  category: columnCategorySchema,
  position: positionSchema.optional(),
  wipLimit: z.number().int().positive().max(100_000).nullable().default(null),
  color: colorSchema.default("#94a3b8"),
});

export const createBoardSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(120),
    slug: slugSchema.optional(),
    description: z.string().trim().max(20_000).default(""),
    methodology: z.enum(["KANBAN", "SCRUM", "HYBRID"] as const).default("HYBRID"),
    visibility: z.enum(["WORKSPACE", "PRIVATE"] as const).default("WORKSPACE"),
    color: colorSchema.default("#6d5dfc"),
    columns: z.array(boardColumnInputSchema).min(1).max(50).optional(),
  })
  .superRefine((input, context) => {
    if (!input.columns) return;
    const names = input.columns.map((column) => column.name.toLocaleLowerCase("es"));
    if (new Set(names).size !== names.length) {
      context.addIssue({ code: "custom", path: ["columns"], message: "Los nombres de columna deben ser únicos." });
    }
  });

export const createColumnSchema = boardColumnInputSchema.extend({ boardId: uuidSchema });

export const createSprintSchema = z
  .strictObject({
    boardId: uuidSchema.nullable().default(null),
    name: z.string().trim().min(1).max(120),
    goal: z.string().trim().max(20_000).nullable().default(null),
    startDate: nullableDateSchema.default(null),
    endDate: nullableDateSchema.default(null),
  })
  .superRefine(validateDateRange);

export const startSprintSchema = z
  .strictObject({
    sprintId: uuidSchema,
    startDate: nullableDateSchema.optional(),
    endDate: nullableDateSchema.optional(),
  })
  .superRefine(validateDateRange);

export const closeSprintSchema = z
  .strictObject({
    sprintId: uuidSchema,
    incompleteDestination: z.enum(["BACKLOG", "SPRINT"] as const).default("BACKLOG"),
    targetSprintId: uuidSchema.nullable().default(null),
  })
  .superRefine((input, context) => {
    if (input.incompleteDestination === "SPRINT" && !input.targetSprintId) {
      context.addIssue({ code: "custom", path: ["targetSprintId"], message: "Debe elegir el sprint de destino." });
    }
    if (input.incompleteDestination === "BACKLOG" && input.targetSprintId) {
      context.addIssue({ code: "custom", path: ["targetSprintId"], message: "El backlog no usa un sprint de destino." });
    }
    if (input.targetSprintId === input.sprintId) {
      context.addIssue({ code: "custom", path: ["targetSprintId"], message: "El sprint de destino debe ser distinto." });
    }
  });

export const assignTaskToSprintSchema = z.strictObject({
  taskId: uuidSchema,
  sprintId: uuidSchema.nullable(),
  expectedVersion: z.number().int().positive(),
});

export const createProfileSchema = z.strictObject({
  userId: uuidSchema.nullable().default(null),
  profileSlug: slugSchema.optional(),
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(255).nullable().default(null),
  workRole: z.string().trim().min(1).max(120),
  accessLevel: accessLevelSchema.default("MEMBER"),
  status: z.enum(["ACTIVE", "INVITED", "DISABLED"] as const).default("ACTIVE"),
  avatarColor: colorSchema.default("#6d5dfc"),
  capacityPoints: z.number().int().min(0).max(100_000).default(20),
});

export const updateProfileSchema = z
  .strictObject({
    membershipId: uuidSchema,
    profileSlug: slugSchema.optional(),
    fullName: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().toLowerCase().email().max(255).nullable().optional(),
    workRole: z.string().trim().min(1).max(120).optional(),
    accessLevel: accessLevelSchema.optional(),
    status: z.enum(["ACTIVE", "INVITED", "DISABLED"] as const).optional(),
    avatarColor: colorSchema.optional(),
    capacityPoints: z.number().int().min(0).max(100_000).optional(),
  })
  .refine(
    (input) => Object.entries(input).some(([key, value]) => key !== "membershipId" && value !== undefined),
    "Debe indicar al menos un campo para editar.",
  );

export type CreateTaskInput = z.input<typeof createTaskSchema>;
export type UpdateTaskInput = z.input<typeof updateTaskSchema>;
export type ArchiveTaskInput = z.input<typeof archiveTaskSchema>;
export type MoveTaskInput = z.input<typeof moveTaskSchema>;
export type CreateCommentInput = z.input<typeof createCommentSchema>;
export type UpdateCommentInput = z.input<typeof updateCommentSchema>;
export type DeleteCommentInput = z.input<typeof deleteCommentSchema>;
export type CreateChecklistInput = z.input<typeof createChecklistSchema>;
export type CreateChecklistItemInput = z.input<typeof createChecklistItemSchema>;
export type UpdateChecklistItemInput = z.input<typeof updateChecklistItemSchema>;
export type CreateBoardInput = z.input<typeof createBoardSchema>;
export type CreateColumnInput = z.input<typeof createColumnSchema>;
export type CreateSprintInput = z.input<typeof createSprintSchema>;
export type StartSprintInput = z.input<typeof startSprintSchema>;
export type CloseSprintInput = z.input<typeof closeSprintSchema>;
export type AssignTaskToSprintInput = z.input<typeof assignTaskToSprintSchema>;
export type CreateProfileInput = z.input<typeof createProfileSchema>;
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;

export function parseDomainInput<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new DomainError(400, "VALIDATION_ERROR", "Los datos enviados no son válidos.", result.error.issues);
  }
  return result.data;
}

export function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");

  if (!slug) {
    throw new DomainError(400, "INVALID_SLUG", "No fue posible generar un identificador válido.");
  }
  return slug;
}

type DatabaseErrorLike = { code?: unknown; constraint_name?: unknown };

export function rethrowDatabaseError(
  error: unknown,
  conflictCode = "RESOURCE_CONFLICT",
  conflictMessage = "El recurso entra en conflicto con otro existente.",
): never {
  if (error instanceof DomainError) throw error;

  const databaseError = error as DatabaseErrorLike;
  if (databaseError?.code === "23505") {
    throw new DomainError(409, conflictCode, conflictMessage);
  }
  if (databaseError?.code === "23503" || databaseError?.code === "23514") {
    throw new DomainError(422, "INTEGRITY_CONSTRAINT", "La operación incumple una regla de integridad.");
  }
  if (databaseError?.code === "40001" || databaseError?.code === "40P01") {
    throw new DomainError(
      409,
      "TRANSACTION_RETRY_REQUIRED",
      "La operación coincidió con otro cambio. Vuelva a intentarlo.",
    );
  }
  if (["22003", "22007", "22008", "22P02"].includes(String(databaseError?.code))) {
    throw new DomainError(422, "INVALID_DATABASE_VALUE", "Uno de los valores no es compatible con el recurso.");
  }
  throw error;
}
