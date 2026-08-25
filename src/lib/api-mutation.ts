import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getWorkspaceContext } from "@/lib/data";
import { DomainError } from "@/lib/domain/validators";
import {
  assertMutationRequest,
  readBoundedJson,
  RequestSecurityError,
} from "@/lib/security";

const headers = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  Vary: "Cookie, Origin",
};

export async function mutationContext(request: Request) {
  assertMutationRequest(request);
  const body = await readBoundedJson(request, 128 * 1024);
  const session = await getCurrentSession();
  if (!session) throw new DomainError(401, "AUTHENTICATION_REQUIRED", "Debes iniciar sesión para continuar.");
  const context = await getWorkspaceContext(session.user.id);
  if (!context) throw new DomainError(403, "WORKSPACE_REQUIRED", "No tienes un espacio de trabajo activo.");
  return { body, context, session };
}

export function apiSuccess(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers });
}

export function apiFailure(error: unknown) {
  if (error instanceof RequestSecurityError) {
    return NextResponse.json({ error: error.message, code: "REQUEST_REJECTED" }, { status: error.status, headers });
  }
  if (error instanceof DomainError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        ...(error.code === "VALIDATION_ERROR" ? { details: error.details } : {}),
      },
      { status: error.status, headers },
    );
  }
  console.error("Una mutación de dominio no pudo completarse.");
  return NextResponse.json({ error: "No fue posible completar la operación.", code: "INTERNAL_ERROR" }, { status: 500, headers });
}

