import bcrypt from "bcryptjs";
import { z } from "zod";
import { apiFailure, apiSuccess, mutationContext } from "@/lib/api-mutation";
import { db } from "@/lib/db";
import {
  accountPasswordSchema,
  DomainError,
  parseDomainInput,
} from "@/lib/domain/validators";
import { recordSecurityAudit } from "@/lib/security-audit";

export const runtime = "nodejs";

const bodySchema = z.strictObject({
  currentPassword: z.string().min(1).max(256),
  newPassword: accountPasswordSchema,
}).superRefine((input, context) => {
  if (input.currentPassword === input.newPassword) {
    context.addIssue({ code: "custom", path: ["newPassword"], message: "La nueva contraseña debe ser diferente." });
  }
});

export async function POST(request: Request) {
  try {
    const { body, context, session } = await mutationContext(request);
    const input = parseDomainInput(bodySchema, body);
    const [user] = await db()<[{ passwordHash: string | null }]>`
      SELECT password_hash AS "passwordHash"
      FROM users
      WHERE id = ${session.user.id} AND status = 'ACTIVE'
      LIMIT 1
    `;
    const valid = Boolean(user?.passwordHash && await bcrypt.compare(input.currentPassword, user.passwordHash));
    if (!valid) {
      await recordSecurityAudit({
        request,
        action: "auth.password_change",
        outcome: "FAILURE",
        workspaceId: context.workspaceId,
        userId: session.user.id,
        membershipId: context.membershipId,
        sessionId: session.id,
      });
      throw new DomainError(400, "CURRENT_PASSWORD_INVALID", "La contraseña actual no es correcta.");
    }

    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    await db().begin(async (transaction) => {
      await transaction`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${session.user.id}`;
      await transaction`DELETE FROM sessions WHERE user_id = ${session.user.id} AND id <> ${session.id}`;
    });
    await recordSecurityAudit({
      request,
      action: "auth.password_change",
      outcome: "SUCCESS",
      workspaceId: context.workspaceId,
      userId: session.user.id,
      membershipId: context.membershipId,
      sessionId: session.id,
    });
    return apiSuccess({ changed: true });
  } catch (error) {
    return apiFailure(error);
  }
}
