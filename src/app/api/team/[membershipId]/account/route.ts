import { apiFailure, apiSuccess, mutationContext } from "@/lib/api-mutation";
import { createAccountForProfile } from "@/lib/domain/accounts";
import {
  accountCredentialsSchema,
  DomainError,
  parseDomainInput,
} from "@/lib/domain/validators";
import { recordSecurityAudit } from "@/lib/security-audit";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ membershipId: string }> },
) {
  let auditActor: {
    workspaceId: string;
    userId: string;
    membershipId: string;
    sessionId: string;
  } | null = null;

  try {
    const { membershipId } = await params;
    const { body, context, session } = await mutationContext(request);
    const credentials = parseDomainInput(accountCredentialsSchema, body);
    auditActor = {
      workspaceId: context.workspaceId,
      userId: session.user.id,
      membershipId: context.membershipId,
      sessionId: session.id,
    };

    const result = await createAccountForProfile(context, {
      membershipId,
      ...credentials,
    });
    await recordSecurityAudit({
      request,
      action: "admin.account_link",
      outcome: "SUCCESS",
      ...auditActor,
      metadata: {
        targetUserId: result.account.id,
        targetMembershipId: result.profile.id,
        targetAccessLevel: result.profile.accessLevel,
      },
    });
    return apiSuccess(result, 201);
  } catch (error) {
    if (auditActor && error instanceof DomainError && error.status === 403) {
      await recordSecurityAudit({
        request,
        action: "admin.account_link",
        outcome: "DENIED",
        ...auditActor,
        metadata: { errorCode: error.code },
      });
    }
    return apiFailure(error);
  }
}
