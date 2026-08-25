import { z } from "zod";
import { apiFailure, apiSuccess, mutationContext } from "@/lib/api-mutation";
import { db } from "@/lib/db";
import {
  MANAGE_ACCESS,
  recordActivity,
  requireWorkspaceAccess,
} from "@/lib/domain/activity";
import { DomainError, parseDomainInput } from "@/lib/domain/validators";

export const runtime = "nodejs";
const bodySchema = z.strictObject({ enabled: z.boolean() });

export async function POST(request: Request, { params }: { params: Promise<{ ruleId: string }> }) {
  try {
    const { ruleId } = await params;
    const { body, context } = await mutationContext(request);
    const input = parseDomainInput(bodySchema, body);
    const result = await db().begin(async (transaction) => {
      await requireWorkspaceAccess(transaction, context, MANAGE_ACCESS);
      const [rule] = await transaction<{
        id: string;
        boardId: string | null;
        name: string;
        isEnabled: boolean;
      }[]>`
        UPDATE automation_rules
        SET is_enabled = ${input.enabled}
        WHERE id = ${ruleId} AND workspace_id = ${context.workspaceId}
        RETURNING id, board_id AS "boardId", name, is_enabled AS "isEnabled"
      `;
      if (!rule) throw new DomainError(404, "AUTOMATION_NOT_FOUND", "La automatización no existe.");
      await recordActivity(transaction, context, {
        boardId: rule.boardId,
        entityType: "automation_rule",
        entityId: rule.id,
        action: rule.isEnabled ? "automation.enabled" : "automation.disabled",
        summary: `${rule.isEnabled ? "Se activó" : "Se pausó"} la automatización «${rule.name}».`,
      });
      return rule;
    });
    return apiSuccess({ rule: result });
  } catch (error) {
    return apiFailure(error);
  }
}
