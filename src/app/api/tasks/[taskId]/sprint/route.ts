import { z } from "zod";
import { apiFailure, apiSuccess, mutationContext } from "@/lib/api-mutation";
import { assignTaskToSprint } from "@/lib/domain/sprints";
import { parseDomainInput, uuidSchema } from "@/lib/domain/validators";

export const runtime = "nodejs";
const bodySchema = z.strictObject({ sprintId: uuidSchema.nullable(), version: z.number().int().positive() });

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const { body, context } = await mutationContext(request);
    const input = parseDomainInput(bodySchema, body);
    const task = await assignTaskToSprint(context, {
      taskId,
      sprintId: input.sprintId,
      expectedVersion: input.version,
    });
    return apiSuccess({ task });
  } catch (error) {
    return apiFailure(error);
  }
}

