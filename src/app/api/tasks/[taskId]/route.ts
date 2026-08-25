import { z } from "zod";
import { apiFailure, apiSuccess, mutationContext } from "@/lib/api-mutation";
import { updateTask } from "@/lib/domain/tasks";
import {
  parseDomainInput,
  taskPrioritySchema,
  taskTypeSchema,
  updateTaskSchema,
  uuidSchema,
} from "@/lib/domain/validators";

export const runtime = "nodejs";

const requestSchema = z.strictObject({
  boardId: uuidSchema,
  columnId: uuidSchema,
  title: z.string(),
  description: z.string(),
  taskType: taskTypeSchema,
  priority: taskPrioritySchema,
  storyPoints: z.number().int().nonnegative().nullable(),
  startDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  sprintId: uuidSchema.nullable(),
  assigneeIds: z.array(uuidSchema),
  labelIds: z.array(uuidSchema),
  version: z.number().int().positive(),
});

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const { body, context } = await mutationContext(request);
    const input = parseDomainInput(requestSchema, body);
    const updated = await updateTask(context, parseDomainInput(updateTaskSchema, {
      taskId,
      expectedVersion: input.version,
      title: input.title,
      description: input.description,
      taskType: input.taskType,
      priority: input.priority,
      storyPoints: input.storyPoints,
      startDate: input.startDate,
      dueDate: input.dueDate,
      sprintId: input.sprintId,
      assigneeIds: input.assigneeIds,
      labelIds: input.labelIds,
    }));
    return apiSuccess({ task: updated });
  } catch (error) {
    return apiFailure(error);
  }
}
