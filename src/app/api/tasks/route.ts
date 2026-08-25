import { apiFailure, apiSuccess, mutationContext } from "@/lib/api-mutation";
import { createTask } from "@/lib/domain/tasks";
import { createTaskSchema, parseDomainInput } from "@/lib/domain/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { body, context } = await mutationContext(request);
    const task = await createTask(context, parseDomainInput(createTaskSchema, body));
    return apiSuccess({ task }, 201);
  } catch (error) {
    return apiFailure(error);
  }
}

