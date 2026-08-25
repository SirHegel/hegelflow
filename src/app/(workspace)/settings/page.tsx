import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/settings-view";
import { getSettingsData } from "@/lib/data";
import { requirePageContext } from "@/lib/page-context";

export const metadata: Metadata = { title: "Configuración" };

export default async function SettingsPage() {
  const { context, session } = await requirePageContext();
  const data = await getSettingsData(
    context.workspaceId,
    context.membershipId,
    context.accessLevel,
  );
  return <SettingsView data={data} context={context} sessionExpiresAt={session.expiresAt.toISOString()} />;
}
