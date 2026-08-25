import type { Metadata } from "next";
import { SprintManager } from "@/components/sprints/sprint-manager";
import { getBacklogData } from "@/lib/data";
import { requirePageContext } from "@/lib/page-context";

export const metadata: Metadata = { title: "Sprints" };

export default async function SprintsPage() {
  const { context } = await requirePageContext();
  const data = await getBacklogData(context.workspaceId, context.membershipId, context.accessLevel);
  return <SprintManager sprints={data.sprints} tasks={data.tasks} members={data.members} context={context} />;
}
