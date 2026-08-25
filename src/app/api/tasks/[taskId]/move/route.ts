import { z } from "zod";
import { apiFailure, apiSuccess, mutationContext } from "@/lib/api-mutation";
import { moveTask } from "@/lib/domain/tasks";
import { parseDomainInput, uuidSchema } from "@/lib/domain/validators";

export const runtime = "nodejs";
const bodySchema = z.strictObject({
  columnId: uuidSchema,
  beforeTaskId: uuidSchema.nullable().optional(),
  afterTaskId: uuidSchema.nullable().optional(),
  version: z.number().int().positive(),
});

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const { body, context } = await mutationContext(request);
    const input = parseDomainInput(bodySchema, body);
    const task = await moveTask(context, {
      taskId,
      toColumnId: input.columnId,
      expectedVersion: input.version,
      beforeTaskId: input.beforeTaskId,
      afterTaskId: input.afterTaskId,
    });
    return apiSuccess({ task, version: task.version });
  } catch (error) {
    return apiFailure(error);
  }
}

