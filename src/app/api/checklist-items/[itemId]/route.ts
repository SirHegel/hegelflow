import { z } from "zod";
import { apiFailure, apiSuccess, mutationContext } from "@/lib/api-mutation";
import { updateChecklistItem } from "@/lib/domain/tasks";
import { parseDomainInput } from "@/lib/domain/validators";

export const runtime = "nodejs";
const bodySchema = z.strictObject({
  content: z.string().trim().min(1).max(400).optional(),
  isComplete: z.boolean().optional(),
  position: z.number().finite().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await params;
    const { body, context } = await mutationContext(request);
    const input = parseDomainInput(bodySchema, body);
    const item = await updateChecklistItem(context, { itemId, ...input });
    return apiSuccess({ item });
  } catch (error) {
    return apiFailure(error);
  }
}

