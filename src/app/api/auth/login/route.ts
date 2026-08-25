import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  authenticateCredentials,
  createSession,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@/lib/auth";
import {
  assertMutationRequest,
  clearLoginRateLimit,
  consumeLoginRateLimit,
  getClientIp,
  getSafeUserAgent,
  readBoundedJson,
  RequestSecurityError,
  normalizeUsername,
  sha256,
} from "@/lib/security";
import { recordSecurityAudit } from "@/lib/security-audit";

export const runtime = "nodejs";

const loginSchema = z.strictObject({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256),
});

const responseHeaders = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  Vary: "Origin",
};

function errorResponse(message: string, status: number, retryAfter?: number) {
  const response = NextResponse.json(
    { authenticated: false, message },
    { status, headers: responseHeaders },
  );

  if (retryAfter) response.headers.set("Retry-After", String(retryAfter));
  return response;
}

export async function POST(request: NextRequest) {
  try {
    assertMutationRequest(request);
    const body = await readBoundedJson(request);
    const input = loginSchema.safeParse(body);

    if (!input.success) {
      return errorResponse("Revisa el usuario y la contraseña.", 400);
    }

    const ipAddress = getClientIp(request);
    const rateLimit = await consumeLoginRateLimit(input.data.username, ipAddress);
    if (!rateLimit.allowed) {
      await recordSecurityAudit({
        request,
        action: "auth.login.rate_limited",
        outcome: "DENIED",
        metadata: { usernameHash: sha256(normalizeUsername(input.data.username)) },
      });
      return errorResponse(
        "Demasiados intentos. Espera unos minutos antes de volver a intentarlo.",
        429,
        rateLimit.retryAfterSeconds,
      );
    }

    const user = await authenticateCredentials(
      input.data.username,
      input.data.password,
    );

    if (!user) {
      await recordSecurityAudit({
        request,
        action: "auth.login",
        outcome: "FAILURE",
        metadata: { usernameHash: sha256(normalizeUsername(input.data.username)) },
      });
      return errorResponse("Usuario o contraseña incorrectos.", 401);
    }

    await clearLoginRateLimit(rateLimit.keyHashes);
    const session = await createSession(user.id, {
      ipAddress,
      userAgent: getSafeUserAgent(request),
    });
    await recordSecurityAudit({
      request,
      action: "auth.login",
      outcome: "SUCCESS",
      userId: user.id,
    });

    const response = NextResponse.json(
      { authenticated: true },
      { status: 200, headers: responseHeaders },
    );
    response.cookies.set(
      SESSION_COOKIE_NAME,
      session.token,
      sessionCookieOptions(session.expiresAt),
    );
    return response;
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return errorResponse(error.message, error.status);
    }

    // No se adjunta la excepción para evitar que una consulta o credencial
    // termine expuesta en los registros de producción.
    console.error("No fue posible completar el inicio de sesión.");
    return errorResponse("No pudimos iniciar sesión en este momento.", 500);
  }
}
