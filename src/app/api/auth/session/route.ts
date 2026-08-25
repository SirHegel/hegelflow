import { NextResponse, type NextRequest } from "next/server";
import {
  getSessionByToken,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";

export const runtime = "nodejs";

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie",
};

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = await getSessionByToken(token);

    if (!session) {
      return NextResponse.json(
        { authenticated: false, user: null, memberships: [] },
        { status: 401, headers: responseHeaders },
      );
    }

    return NextResponse.json(
      {
        authenticated: true,
        expiresAt: session.expiresAt.toISOString(),
        user: session.user,
        memberships: session.memberships,
      },
      { status: 200, headers: responseHeaders },
    );
  } catch {
    console.error("No fue posible consultar la sesión.");
    return NextResponse.json(
      {
        authenticated: false,
        user: null,
        memberships: [],
        message: "No pudimos verificar la sesión en este momento.",
      },
      { status: 503, headers: responseHeaders },
    );
  }
}
