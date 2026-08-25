import type { Metadata } from "next";
import { TeamView } from "@/components/team/team-view";
import { getTeamData } from "@/lib/data";
import { requirePageContext } from "@/lib/page-context";

export const metadata: Metadata = { title: "Equipo" };

export default async function TeamPage() {
  const { context } = await requirePageContext();
  const members = await getTeamData(context.workspaceId, context.membershipId, context.accessLevel);
  return <TeamView members={members} context={context} />;
}
