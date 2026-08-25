import { apiFailure, apiSuccess, mutationContext } from "@/lib/api-mutation";
import { startSprint } from "@/lib/domain/sprints";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ sprintId: string }> }) {
  try {
    const { sprintId } = await params;
    const { context } = await mutationContext(request);
    const sprint = await startSprint(context, { sprintId });
    return apiSuccess({ sprint });
  } catch (error) {
    return apiFailure(error);
  }
}

