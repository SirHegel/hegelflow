import { describe, expect, it } from "vitest";
import { sanitizeSecurityAuditMetadata } from "@/lib/security-audit";

describe("metadata de auditoría de seguridad", () => {
  it("elimina claves sensibles sin importar formato, mayúsculas o profundidad", () => {
    const sanitized = sanitizeSecurityAuditMetadata({
      targetUserId: "user-123",
      password: "plain-password",
      passwordHash: "bcrypt-hash",
      nested: {
        current_password: "old-password",
        AccessToken: "access-token",
        safe: true,
        items: [
          {
            Cookie: "session-cookie",
            authorization: "Bearer bearer-token",
            event: "account.created",
          },
          {
            DATABASE_URL: "postgres://user:password@example.invalid/db",
            count: 2,
          },
        ],
      },
      clientSecret: "client-secret",
      api_key: "api-key",
      "private-key": "private-key",
      connectionString: "connection-string",
    });

    expect(sanitized).toEqual({
      targetUserId: "user-123",
      nested: {
        safe: true,
        items: [
          { event: "account.created" },
          { count: 2 },
        ],
      },
    });
  });

  it("normaliza claves Unicode antes de detectar secretos", () => {
    expect(sanitizeSecurityAuditMetadata({
      "ＰＡＳＳＷＯＲＤ": "plain-password",
      outcome: "SUCCESS",
    })).toEqual({ outcome: "SUCCESS" });
  });

  it("descarta claves capaces de alterar el prototipo del resultado", () => {
    const input = JSON.parse('{"__proto__":{"polluted":true},"constructor":"unsafe","safe":"kept"}') as Record<string, unknown>;
    const sanitized = sanitizeSecurityAuditMetadata(input);

    expect(sanitized).toEqual({ safe: "kept" });
    expect(Object.prototype).not.toHaveProperty("polluted");
  });

  it("tolera ciclos y valores no JSON sin mutar la entrada", () => {
    const nested: Record<string, unknown> = { safe: "kept", password: "removed" };
    nested.self = nested;
    const input = { nested, invalidNumber: Number.POSITIVE_INFINITY };

    expect(sanitizeSecurityAuditMetadata(input)).toEqual({
      nested: { safe: "kept" },
      invalidNumber: null,
    });
    expect(nested).toMatchObject({ safe: "kept", password: "removed", self: nested });
  });
});
