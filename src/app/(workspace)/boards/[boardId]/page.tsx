import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { KanbanBoard } from "@/components/board/kanban-board";
import { getBoardData } from "@/lib/data";
import { requirePageContext } from "@/lib/page-context";
import { dateKeyInTimeZone } from "@/lib/utils";

export const metadata: Metadata = { title: "Tablero" };

export default async function BoardPage({ params }: PageProps<"/boards/[boardId]">) {
  const { boardId } = await params;
  const { context, session } = await requirePageContext();
  const data = await getBoardData(boardId, context.workspaceId, context.membershipId, context.accessLevel);
  if (!data) notFound();

  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Cargando tablero…</div>}>
      <KanbanBoard
        initialData={data}
        context={context}
        initialTodayKey={dateKeyInTimeZone(new Date(), session.user.timezone)}
        timeZone={session.user.timezone}
      />
    </Suspense>
  );
}
