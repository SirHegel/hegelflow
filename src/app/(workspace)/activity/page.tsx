import type { Metadata } from "next";
import {
  Activity,
  Archive,
  CheckCircle2,
  CirclePlus,
  LogIn,
  MessageSquareText,
  MoveRight,
  ShieldCheck,
  UserRoundCog,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/ui/section-heading";
import { getActivity } from "@/lib/data";
import { requirePageContext } from "@/lib/page-context";
import { formatRelativeDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Actividad" };

const actionIcons = {
  moved: MoveRight,
  created: CirclePlus,
  completed: CheckCircle2,
  archived: Archive,
  commented: MessageSquareText,
  member: UserRoundCog,
  login: LogIn,
};

function iconFor(action: string) {
  const key = Object.keys(actionIcons).find((candidate) => action.toLowerCase().includes(candidate));
  return key ? actionIcons[key as keyof typeof actionIcons] : Activity;
}

export default async function ActivityPage() {
  const { context } = await requirePageContext();
  const activity = await getActivity(
    context.workspaceId,
    context.membershipId,
    context.accessLevel,
    100,
  );
  return (
    <div className="mx-auto max-w-5xl space-y-7 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <SectionHeading eyebrow="Trazabilidad" title="Actividad" description="Una cronología visible de decisiones, movimientos y cambios importantes dentro del espacio." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6"><div><h2 className="text-sm font-bold text-slate-900">Cronología</h2><p className="mt-0.5 text-xs text-slate-400">Últimos {activity.length} eventos</p></div><Badge>Tiempo real</Badge></div>
          <div className="px-5 sm:px-6">
            {activity.map((item, index) => {
              const Icon = iconFor(item.action);
              return (
                <article key={item.id} className="relative flex gap-4 py-5">
                  {index < activity.length - 1 ? <span className="absolute bottom-0 left-[19px] top-12 w-px bg-slate-200" /> : null}
                  {item.actorName ? <Avatar name={item.actorName} color={item.actorColor} size="md" /> : <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 ring-2 ring-white"><Icon className="size-4" /></span>}
                  <div className="min-w-0 flex-1 pt-0.5"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-700"><strong className="font-bold text-slate-900">{item.actorName ?? "Sistema"}</strong> {item.summary.charAt(0).toLowerCase() + item.summary.slice(1)}</p><time className="shrink-0 text-[10px] font-medium text-slate-400" dateTime={item.createdAt}>{formatRelativeDate(item.createdAt)}</time></div><div className="mt-2 flex items-center gap-2"><Badge>{item.entityType}</Badge><span className="text-[10px] text-slate-300">{item.action}</span></div></div>
                </article>
              );
            })}
            {!activity.length ? <div className="py-16 text-center"><Activity className="mx-auto size-8 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">Todavía no hay actividad</p><p className="mt-1 text-xs text-slate-400">Los cambios del equipo aparecerán aquí.</p></div> : null}
          </div>
        </section>
        <aside className="space-y-4">
          <div className="surface p-5"><div className="grid size-10 place-items-center rounded-xl bg-violet-50 text-violet-600"><ShieldCheck className="size-5" /></div><h2 className="mt-4 text-sm font-bold text-slate-900">Auditoría protegida</h2><p className="mt-2 text-xs leading-5 text-slate-500">La actividad de negocio se presenta aquí. Los eventos de seguridad y acceso permanecen separados y restringidos al propietario.</p></div>
          <div className="surface p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Retención</p><p className="mt-2 text-2xl font-bold text-slate-900">Completa</p><p className="mt-1 text-xs leading-5 text-slate-500">Sin límites comerciales artificiales. La política de retención será configurable por espacio.</p></div>
        </aside>
      </div>
    </div>
  );
}
