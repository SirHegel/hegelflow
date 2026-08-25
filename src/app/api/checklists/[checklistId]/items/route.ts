import { z } from "zod";
import { apiFailure, apiSuccess, mutationContext } from "@/lib/api-mutation";
import { createChecklistItem } from "@/lib/domain/tasks";
import { parseDomainInput } from "@/lib/domain/validators";

export const runtime = "nodejs";
const bodySchema = z.strictObject({ content: z.string().trim().min(1).max(400) });

export async function POST(request: Request, { params }: { params: Promise<{ checklistId: string }> }) {
  try {
    const { checklistId } = await params;
    const { body, context } = await mutationContext(request);
    const input = parseDomainInput(bodySchema, body);
    const item = await createChecklistItem(context, { checklistId, content: input.content });
    return apiSuccess({ item }, 201);
  } catch (error) {
    return apiFailure(error);
  }
}

