import { z } from "zod";
import { apiFailure, apiSuccess, mutationContext } from "@/lib/api-mutation";
import { archiveTask } from "@/lib/domain/tasks";
import { parseDomainInput } from "@/lib/domain/validators";

export const runtime = "nodejs";
const bodySchema = z.strictObject({ version: z.number().int().positive() });

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const { body, context } = await mutationContext(request);
    const input = parseDomainInput(bodySchema, body);
    const task = await archiveTask(context, { taskId, expectedVersion: input.version });
    return apiSuccess({ task });
  } catch (error) {
    return apiFailure(error);
  }
}

