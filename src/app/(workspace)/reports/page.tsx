import type { Metadata } from "next";
import { ReportsDashboard } from "@/components/reports/ReportsDashboard";
import { SectionHeading } from "@/components/ui/section-heading";
import { getReportData } from "@/lib/data";
import { requirePageContext } from "@/lib/page-context";

export const metadata: Metadata = { title: "Reportes" };

export default async function ReportsPage() {
  const { context } = await requirePageContext();
  const data = await getReportData(context.workspaceId, context.membershipId, context.accessLevel);
  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <SectionHeading eyebrow="Analítica ágil" title="Reportes" description="Burndown, velocidad, flujo y tiempo de ciclo calculados desde el historial real de cada tarea." />
      <ReportsDashboard data={data} className="mt-7" />
    </div>
  );
}
