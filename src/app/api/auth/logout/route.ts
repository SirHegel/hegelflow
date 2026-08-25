import { NextResponse, type NextRequest } from "next/server";
import {
  expiredSessionCookieOptions,
  getSessionByToken,
  revokeSession,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import {
  assertMutationRequest,
  readBoundedJson,
  RequestSecurityError,
} from "@/lib/security";
import { recordSecurityAudit } from "@/lib/security-audit";

export const runtime = "nodejs";

const responseHeaders = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie, Origin",
};

function clearSessionCookie(response: NextResponse) {
  response.cookies.set(
    SESSION_COOKIE_NAME,
    "",
    expiredSessionCookieOptions(),
  );
  return response;
}

export async function POST(request: NextRequest) {
  try {
    assertMutationRequest(request);
    await readBoundedJson(request);
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json(
        { authenticated: false, message: error.message },
        { status: error.status, headers: responseHeaders },
      );
    }
    return NextResponse.json(
      { authenticated: false, message: "La solicitud no es válida." },
      { status: 400, headers: responseHeaders },
    );
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  try {
    const session = await getSessionByToken(token);
    await revokeSession(token);
    if (session) {
      const membership = session.memberships[0];
      await recordSecurityAudit({
        request,
        action: "auth.logout",
        outcome: "SUCCESS",
        userId: session.user.id,
        workspaceId: membership?.workspaceId,
        membershipId: membership?.id,
        sessionId: session.id,
      });
    }
    return clearSessionCookie(NextResponse.json(
      { authenticated: false },
      { status: 200, headers: responseHeaders },
    ));
  } catch {
    console.error("No fue posible revocar la sesión en la base de datos.");
    return clearSessionCookie(NextResponse.json(
      {
        authenticated: false,
        message: "La sesión local se cerró, pero no fue posible confirmar la revocación.",
      },
      { status: 503, headers: responseHeaders },
    ));
  }
}
