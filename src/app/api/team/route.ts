import { apiFailure, apiSuccess, mutationContext } from "@/lib/api-mutation";
import { createProfile } from "@/lib/domain/boards";
import { createProfileSchema, parseDomainInput } from "@/lib/domain/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { body, context } = await mutationContext(request);
    const profile = await createProfile(context, parseDomainInput(createProfileSchema, body));
    return apiSuccess({ profile }, 201);
  } catch (error) {
    return apiFailure(error);
  }
}

