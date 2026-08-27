import { afterEach, describe, expect, it, vi } from "vitest";

import { apiFailure, apiSuccess } from "@/lib/api-mutation";
import { DomainError } from "@/lib/domain/validators";
import { RequestSecurityError } from "@/lib/security";

function expectPrivateMutationHeaders(response: Response) {
  expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
  expect(response.headers.get("pragma")).toBe("no-cache");
  expect(response.headers.get("vary")).toBe("Cookie, Origin");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("contrato de respuestas de mutaciones", () => {
  it("serializa respuestas exitosas con estado y cabeceras privadas", async () => {
    const response = apiSuccess({ created: true }, 201);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ created: true });
    expectPrivateMutationHeaders(response);
  });

  it("conserva el estado público de los rechazos de seguridad", async () => {
    const response = apiFailure(new RequestSecurityError("Origen no permitido.", 403));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Origen no permitido.",
      code: "REQUEST_REJECTED",
    });
    expectPrivateMutationHeaders(response);
  });

  it("expone detalles únicamente para errores de validación", async () => {
    const validation = apiFailure(
      new DomainError(422, "VALIDATION_ERROR", "Datos inválidos.", { field: "title" }),
    );
    const forbidden = apiFailure(
      new DomainError(403, "FORBIDDEN", "Acceso denegado.", { internal: "hidden" }),
    );

    await expect(validation.json()).resolves.toEqual({
      error: "Datos inválidos.",
      code: "VALIDATION_ERROR",
      details: { field: "title" },
    });
    await expect(forbidden.json()).resolves.toEqual({
      error: "Acceso denegado.",
      code: "FORBIDDEN",
    });
    expect(validation.status).toBe(422);
    expect(forbidden.status).toBe(403);
    expectPrivateMutationHeaders(validation);
    expectPrivateMutationHeaders(forbidden);
  });

  it("no filtra datos de fallos inesperados", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = apiFailure(new Error("cadena de conexión secreta"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "No fue posible completar la operación.",
      code: "INTERNAL_ERROR",
    });
    expect(consoleError).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith("Una mutación de dominio no pudo completarse.");
    expectPrivateMutationHeaders(response);
  });
});
