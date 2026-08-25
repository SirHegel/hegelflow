import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getDashboardData } from "@/lib/data";
import { requirePageContext } from "@/lib/page-context";

export const metadata: Metadata = { title: "Resumen" };

export default async function DashboardPage() {
  const { context } = await requirePageContext();
  const data = await getDashboardData(context.workspaceId, context.membershipId, context.accessLevel);
  return <DashboardView context={context} data={data} />;
}
