import { z } from "zod";
import { apiFailure, apiSuccess, mutationContext } from "@/lib/api-mutation";
import { createChecklist } from "@/lib/domain/tasks";
import { parseDomainInput } from "@/lib/domain/validators";

export const runtime = "nodejs";
const bodySchema = z.strictObject({ title: z.string().trim().min(1).max(120).default("Checklist") });

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const { body, context } = await mutationContext(request);
    const input = parseDomainInput(bodySchema, body);
    const checklist = await createChecklist(context, { taskId, title: input.title });
    return apiSuccess({ checklist }, 201);
  } catch (error) {
    return apiFailure(error);
  }
}

