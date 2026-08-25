import { AppShell } from "@/components/layout/app-shell";
import { getWorkspaceBoards } from "@/lib/data";
import { requirePageContext } from "@/lib/page-context";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }: LayoutProps<"/">) {
  const { context } = await requirePageContext();
  const boards = await getWorkspaceBoards(context.workspaceId, context.membershipId, context.accessLevel);

  return (
    <AppShell
      context={context}
      boards={boards.map(({ id, name, color }) => ({ id, name, color }))}
    >
      {children}
    </AppShell>
  );
}
