import { z } from "zod";
import { apiFailure, apiSuccess, mutationContext } from "@/lib/api-mutation";
import { createComment } from "@/lib/domain/tasks";
import { parseDomainInput } from "@/lib/domain/validators";

export const runtime = "nodejs";
const bodySchema = z.strictObject({ body: z.string().trim().min(1).max(10_000) });

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const { body, context } = await mutationContext(request);
    const input = parseDomainInput(bodySchema, body);
    const comment = await createComment(context, { taskId, body: input.body });
    return apiSuccess({ comment }, 201);
  } catch (error) {
    return apiFailure(error);
  }
}

