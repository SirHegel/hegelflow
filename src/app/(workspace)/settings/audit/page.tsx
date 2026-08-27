import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuditAdministrationView } from "@/components/settings/audit-administration-view";
import { getAuditAdministrationData } from "@/lib/data";
import { hasPermission } from "@/lib/permissions";
import { requirePageContext } from "@/lib/page-context";

export const metadata: Metadata = { title: "Administración y auditoría" };

export default async function AuditAdministrationPage() {
  const { context, session } = await requirePageContext();
  if (!hasPermission(context.accessLevel, "audit.read")) notFound();

  const data = await getAuditAdministrationData(context);
  if (!data) notFound();

  return (
    <AuditAdministrationView
      data={data}
      timeZone={session.user.timezone}
    />
  );
}
