import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { getClientIp, sha256 } from "@/lib/security";

type SecurityAuditMetadataValue =
  | string
  | number
  | boolean
  | null
  | SecurityAuditMetadataValue[]
  | { [key: string]: SecurityAuditMetadataValue };

type SecurityAuditMetadata = Record<string, SecurityAuditMetadataValue>;

type SecurityAuditInput = {
  request: Request;
  action: string;
  outcome: "SUCCESS" | "FAILURE" | "DENIED";
  workspaceId?: string | null;
  userId?: string | null;
  membershipId?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, unknown>;
};

const MAX_METADATA_DEPTH = 12;
const SENSITIVE_KEY_FRAGMENTS = [
  "password",
  "passwd",
  "pwd",
  "token",
  "cookie",
  "secret",
  "authorization",
  "credential",
  "databaseurl",
  "dburl",
  "connectionstring",
  "connectionurl",
  "apikey",
  "privatekey",
  "dsn",
] as const;

function normalizedMetadataKey(key: string): string {
  return key
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]/g, "");
}

function isSensitiveMetadataKey(key: string): boolean {
  const normalized = normalizedMetadataKey(key);
  if (["proto", "prototype", "constructor"].includes(normalized)) return true;
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

function sanitizeMetadataValue(
  value: unknown,
  depth: number,
  ancestors: WeakSet<object>,
): SecurityAuditMetadataValue | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "object" || depth >= MAX_METADATA_DEPTH) return undefined;
  if (ancestors.has(value)) return undefined;

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item) => sanitizeMetadataValue(item, depth + 1, ancestors) ?? null);
    }

    const sanitized: SecurityAuditMetadata = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      if (isSensitiveMetadataKey(key)) continue;
      const nextValue = sanitizeMetadataValue(nestedValue, depth + 1, ancestors);
      if (nextValue !== undefined) sanitized[key] = nextValue;
    }
    return sanitized;
  } finally {
    ancestors.delete(value);
  }
}

export function sanitizeSecurityAuditMetadata(
  metadata: Record<string, unknown>,
): SecurityAuditMetadata {
  const sanitized = sanitizeMetadataValue(metadata, 0, new WeakSet());
  return sanitized && !Array.isArray(sanitized) && typeof sanitized === "object"
    ? sanitized
    : {};
}

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
        ${db().json(sanitizeSecurityAuditMetadata(input.metadata ?? {}))}
      )
    `;
  } catch {
    // La auditoría no debe filtrar errores internos ni cambiar la respuesta de
    // autenticación; el fallo queda visible en la telemetría del runtime.
    console.error("No fue posible registrar un evento de seguridad.");
  }
}
