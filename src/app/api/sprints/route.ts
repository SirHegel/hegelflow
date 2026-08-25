import { apiFailure, apiSuccess, mutationContext } from "@/lib/api-mutation";
import { createSprint } from "@/lib/domain/sprints";
import { createSprintSchema, parseDomainInput } from "@/lib/domain/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { body, context } = await mutationContext(request);
    const sprint = await createSprint(context, parseDomainInput(createSprintSchema, body));
    return apiSuccess({ sprint }, 201);
  } catch (error) {
    return apiFailure(error);
  }
}

