import { cache } from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { getWorkspaceContext } from "@/lib/data";

export const requirePageContext = cache(async () => {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const context = await getWorkspaceContext(session.user.id);
  if (!context) redirect("/login?reason=no-workspace");

  return { session, context };
});

