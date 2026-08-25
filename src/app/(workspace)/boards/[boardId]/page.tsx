import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { KanbanBoard } from "@/components/board/kanban-board";
import { getBoardData } from "@/lib/data";
import { requirePageContext } from "@/lib/page-context";

export const metadata: Metadata = { title: "Tablero" };

export default async function BoardPage({ params }: PageProps<"/boards/[boardId]">) {
  const { boardId } = await params;
  const { context } = await requirePageContext();
  const data = await getBoardData(boardId, context.workspaceId, context.membershipId, context.accessLevel);
  if (!data) notFound();

  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Cargando tablero…</div>}>
      <KanbanBoard
        key={data.tasks.map((task) => `${task.id}:${task.version}`).join("|")}
        initialData={data}
        context={context}
      />
    </Suspense>
  );
}
