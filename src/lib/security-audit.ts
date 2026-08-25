import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { getClientIp, sha256 } from "@/lib/security";

type SecurityAuditInput = {
  request: Request;
  action: string;
  outcome: "SUCCESS" | "FAILURE" | "DENIED";
  workspaceId?: string | null;
  userId?: string | null;
  membershipId?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

export async function recordSecurityAudit(input: SecurityAuditInput) {
  const ip = getClientIp(input.request);
  const requestId = input.request.headers.get("x-vercel-id")?.slice(0, 160) || randomUUID();
  try {
    await db()`
      INSERT INTO security_audit_events (
        workspace_id, user_id, membership_id, session_id,
        action, outcome, request_id, ip_hash, metadata
      ) VALUES (
        ${input.workspaceId ?? null},
        ${input.userId ?? null},
        ${input.membershipId ?? null},
        ${input.sessionId ?? null},
        ${input.action.slice(0, 80)},
        ${input.outcome},
        ${requestId},
        ${ip ? sha256(`audit:ip:${ip}`) : null},
        ${db().json(input.metadata ?? {})}
      )
    `;
  } catch {
    // La auditoría no debe filtrar errores internos ni cambiar la respuesta de
    // autenticación; el fallo queda visible en la telemetría del runtime.
    console.error("No fue posible registrar un evento de seguridad.");
  }
}
