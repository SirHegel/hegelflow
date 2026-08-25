import { apiFailure, apiSuccess, mutationContext } from "@/lib/api-mutation";
import { createBoard } from "@/lib/domain/boards";
import { createBoardSchema, parseDomainInput } from "@/lib/domain/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { body, context } = await mutationContext(request);
    const result = await createBoard(context, parseDomainInput(createBoardSchema, body));
    return apiSuccess(result, 201);
  } catch (error) {
    return apiFailure(error);
  }
}

