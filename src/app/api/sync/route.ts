import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getWorkspaceContext, getWorkspaceRevision } from "@/lib/data";

export const runtime = "nodejs";

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Vary: "Cookie",
};

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json(
        { error: "Debes iniciar sesión para continuar.", code: "AUTHENTICATION_REQUIRED" },
        { status: 401, headers: responseHeaders },
      );
    }

    const context = await getWorkspaceContext(session.user.id);
    if (!context) {
      return NextResponse.json(
        { error: "No tienes un espacio de trabajo activo.", code: "WORKSPACE_REQUIRED" },
        { status: 403, headers: responseHeaders },
      );
    }

    const revision = await getWorkspaceRevision(
      context.workspaceId,
      context.membershipId,
      context.accessLevel,
    );
    return NextResponse.json({ revision }, { status: 200, headers: responseHeaders });
  } catch {
    console.error("No fue posible consultar la revisión del espacio de trabajo.");
    return NextResponse.json(
      { error: "No fue posible consultar la sincronización.", code: "SYNC_UNAVAILABLE" },
      { status: 503, headers: responseHeaders },
    );
  }
}
