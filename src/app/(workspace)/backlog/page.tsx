import type { Metadata } from "next";
import { BacklogView } from "@/components/backlog/backlog-view";
import { getBacklogData } from "@/lib/data";
import { requirePageContext } from "@/lib/page-context";

export const metadata: Metadata = { title: "Backlog" };

export default async function BacklogPage() {
  const { context } = await requirePageContext();
  const data = await getBacklogData(context.workspaceId, context.membershipId, context.accessLevel);
  return <BacklogView data={data} context={context} />;
}
