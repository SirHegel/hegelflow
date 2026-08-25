import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getWorkspaceContext } from "@/lib/data";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ results: [] }, { status: 401 });
  const context = await getWorkspaceContext(session.user.id);
  if (!context) return NextResponse.json({ results: [] }, { status: 403 });
  const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 120) ?? "";
  if (query.length < 2) return NextResponse.json({ results: [] });

  const results = await db()<{
    id: string;
    boardId: string;
    key: string;
    title: string;
    description: string;
    priority: string;
    columnName: string;
  }[]>`
    SELECT
      t.id,
      b.id AS "boardId",
      CONCAT(UPPER(LEFT(b.slug, 3)), '-', t.task_number) AS key,
      t.title,
      LEFT(t.description, 180) AS description,
      t.priority,
      c.name AS "columnName"
    FROM tasks t
    JOIN boards b ON b.id = t.board_id
    JOIN board_columns c ON c.id = t.column_id
    WHERE b.workspace_id = ${context.workspaceId}
      AND b.archived_at IS NULL
      AND t.archived_at IS NULL
      AND (
        ${context.accessLevel === "OWNER" || context.accessLevel === "ADMIN"}
        OR
        b.visibility = 'WORKSPACE'
        OR b.created_by = ${context.membershipId}
        OR EXISTS (
          SELECT 1 FROM board_members bm
          WHERE bm.board_id = b.id AND bm.membership_id = ${context.membershipId}
        )
      )
      AND (
        to_tsvector('spanish', t.title || ' ' || t.description) @@ plainto_tsquery('spanish', ${query})
        OR t.title ILIKE ${`%${query}%`}
        OR CONCAT(UPPER(LEFT(b.slug, 3)), '-', t.task_number) ILIKE ${`%${query}%`}
      )
    ORDER BY
      CASE WHEN t.title ILIKE ${`${query}%`} THEN 0 ELSE 1 END,
      t.updated_at DESC
    LIMIT 12
  `;
  return NextResponse.json({ results }, { headers: { "Cache-Control": "private, no-store" } });
}
