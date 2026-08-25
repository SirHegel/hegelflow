import { z } from "zod";
import { apiFailure, apiSuccess, mutationContext } from "@/lib/api-mutation";
import { closeSprint } from "@/lib/domain/sprints";
import { parseDomainInput, uuidSchema } from "@/lib/domain/validators";

export const runtime = "nodejs";
const bodySchema = z.strictObject({ moveIncompleteToSprintId: uuidSchema.nullable().optional() });

export async function POST(request: Request, { params }: { params: Promise<{ sprintId: string }> }) {
  try {
    const { sprintId } = await params;
    const { body, context } = await mutationContext(request);
    const input = parseDomainInput(bodySchema, body);
    const result = await closeSprint(context, {
      sprintId,
      incompleteDestination: input.moveIncompleteToSprintId ? "SPRINT" : "BACKLOG",
      targetSprintId: input.moveIncompleteToSprintId ?? null,
    });
    return apiSuccess(result);
  } catch (error) {
    return apiFailure(error);
  }
}
