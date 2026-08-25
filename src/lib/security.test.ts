import { describe, expect, it } from "vitest";
import {
  assertMutationRequest,
  generateOpaqueToken,
  normalizeUsername,
  readBoundedJson,
  RequestSecurityError,
  sha256,
} from "@/lib/security";

function request(origin = "https://app.example.com", body = "{}") {
  return new Request("https://app.example.com/api/test", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "X-CSRF-Protection": "1",
      "Sec-Fetch-Site": origin === "https://app.example.com" ? "same-origin" : "cross-site",
    },
    body,
  });
}

describe("seguridad HTTP", () => {
  it("normaliza nombres Unicode y espacios", () => {
    expect(normalizeUsername("  SirHegel  ")).toBe("sirhegel");
    expect(normalizeUsername("ＳＩＲ")).toBe("sir");
  });

  it("genera tokens opacos con suficiente entropía", () => {
    const first = generateOpaqueToken();
    const second = generateOpaqueToken();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
    expect(sha256(first)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("acepta una mutación del mismo origen con cabecera CSRF", () => {
    expect(() => assertMutationRequest(request())).not.toThrow();
  });

  it("bloquea orígenes cruzados", () => {
    expect(() => assertMutationRequest(request("https://evil.example"))).toThrow(RequestSecurityError);
  });

  it("bloquea mutaciones sin cabecera CSRF", () => {
    const unsafe = new Request("https://app.example.com/api/test", {
      method: "POST",
      headers: { Origin: "https://app.example.com", "Content-Type": "application/json" },
      body: "{}",
    });
    expect(() => assertMutationRequest(unsafe)).toThrow(RequestSecurityError);
  });

  it("limita el tamaño del JSON", async () => {
    await expect(readBoundedJson(request(undefined, JSON.stringify({ value: "x".repeat(100) })), 16)).rejects.toMatchObject({ status: 413 });
  });
});

