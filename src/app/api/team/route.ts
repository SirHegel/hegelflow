import { apiFailure, apiSuccess, mutationContext } from "@/lib/api-mutation";
import { createProfileWithAccount } from "@/lib/domain/accounts";
import { createProfile } from "@/lib/domain/boards";
import {
  createTeamMemberSchema,
  DomainError,
  parseDomainInput,
} from "@/lib/domain/validators";
import { recordSecurityAudit } from "@/lib/security-audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let accountRequested = false;
  let auditActor: {
    workspaceId: string;
    userId: string;
    membershipId: string;
    sessionId: string;
  } | null = null;

  try {
    const { body, context, session } = await mutationContext(request);
    const input = parseDomainInput(createTeamMemberSchema, body);
    const { account, ...profileInput } = input;
    auditActor = {
      workspaceId: context.workspaceId,
      userId: session.user.id,
      membershipId: context.membershipId,
      sessionId: session.id,
    };

    if (account) {
      accountRequested = true;
      const result = await createProfileWithAccount(context, {
        ...profileInput,
        account,
      });
      await recordSecurityAudit({
        request,
        action: "admin.account_create",
        outcome: "SUCCESS",
        ...auditActor,
        metadata: {
          targetUserId: result.account.id,
          targetMembershipId: result.profile.id,
          targetAccessLevel: result.profile.accessLevel,
        },
      });
      return apiSuccess(result, 201);
    }

    const profile = await createProfile(context, profileInput);
    return apiSuccess({ profile }, 201);
  } catch (error) {
    if (
      accountRequested
      && auditActor
      && error instanceof DomainError
      && error.status === 403
    ) {
      await recordSecurityAudit({
        request,
        action: "admin.account_create",
        outcome: "DENIED",
        ...auditActor,
        metadata: { errorCode: error.code },
      });
    }
    return apiFailure(error);
  }
}
