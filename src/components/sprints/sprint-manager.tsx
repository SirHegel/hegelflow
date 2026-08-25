"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Flag,
  Gauge,
  LoaderCircle,
  Play,
  Target,
  Trophy,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SectionHeading } from "@/components/ui/section-heading";
import { useTodayKey } from "@/hooks/use-today-key";
import { formatDate, percent } from "@/lib/utils";
import type { Person, Sprint, TaskCard, WorkspaceContext } from "@/lib/types";

export function SprintManager({ sprints, tasks, members, context, initialTodayKey, timeZone }: {
  sprints: Sprint[];
  tasks: TaskCard[];
  members: Person[];
  context: WorkspaceContext;
  initialTodayKey: string;
  timeZone: string;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const todayKey = useTodayKey(initialTodayKey, timeZone);
  const canManage = context.accessLevel === "OWNER" || context.accessLevel === "ADMIN";
  const active = sprints.find((sprint) => sprint.status === "ACTIVE") ?? null;
  const planned = sprints.filter((sprint) => sprint.status === "PLANNED");
  const completed = sprints.filter((sprint) => sprint.status === "COMPLETED");

  async function transition(sprint: Sprint, action: "start" | "complete") {
    const prompt = action === "start"
      ? `¿Iniciar “${sprint.name}”? Solo puede existir un sprint activo.`
      : `¿Completar “${sprint.name}”? Las tareas no terminadas volverán al backlog.`;
    if (!window.confirm(prompt)) return;
    setPendingId(sprint.id);
    setError(null);
    try {
      const response = await fetch(`/api/sprints/${sprint.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" },
        body: JSON.stringify({ moveIncompleteToSprintId: null }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "No fue posible actualizar el sprint.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible actualizar el sprint.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1380px] space-y-7 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <SectionHeading eyebrow="Ejecución" title="Sprints" description="Define un objetivo claro, compromete capacidad y revisa el resultado de cada ciclo de trabajo." />
      {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {active ? (
        <ActiveSprint sprint={active} tasks={tasks.filter((task) => task.sprintId === active.id)} members={members} canManage={canManage} pending={pendingId === active.id} todayKey={todayKey} onComplete={() => transition(active, "complete")} />
      ) : (
        <section className="rounded-2xl border border-dashed border-violet-200 bg-gradient-to-br from-violet-50 to-white p-8 text-center">
          <Target className="mx-auto size-10 text-violet-500" />
          <h2 className="mt-4 text-lg font-bold text-slate-900">No hay un sprint en ejecución</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">Elige uno de los sprints planeados cuando el objetivo, las fechas y el alcance estén listos.</p>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-end justify-between gap-3"><div className="min-w-0 flex-1"><h2 className="text-base font-bold text-slate-900">Próximos sprints</h2><p className="mt-1 break-words text-xs leading-5 text-slate-400">Preparados para planificación y refinamiento</p></div><Badge className="shrink-0">{planned.length} planeados</Badge></div>
        <div className="grid gap-4 lg:grid-cols-2">
          {planned.map((sprint) => {
            const sprintTasks = tasks.filter((task) => task.sprintId === sprint.id);
            const points = sumPoints(sprintTasks);
            return (
              <article key={sprint.id} className="surface p-5 sm:p-6">
                <div className="flex items-start gap-4"><div className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500"><Flag className="size-5" /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="truncate text-base font-bold text-slate-900">{sprint.name}</h3><Badge>Planeado</Badge></div><p className="mt-1.5 line-clamp-2 min-h-10 text-xs leading-5 text-slate-500">{sprint.goal || "Sin objetivo definido."}</p></div></div>
                <div className="mt-5 grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3 text-center"><div><p className="text-lg font-bold text-slate-900">{sprintTasks.length}</p><p className="text-[11px] uppercase tracking-wide text-slate-400">Tareas</p></div><div className="border-x border-slate-200"><p className="text-lg font-bold text-slate-900">{points}</p><p className="text-[11px] uppercase tracking-wide text-slate-400">Puntos</p></div><div><p className="text-lg font-bold text-slate-900">{new Set(sprintTasks.flatMap((task) => task.assignees.map((person) => person.id))).size}</p><p className="text-[11px] uppercase tracking-wide text-slate-400">Personas</p></div></div>
                <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"><span className="inline-flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] leading-5 text-slate-400"><CalendarDays className="size-3.5 shrink-0" /> {formatDate(sprint.startDate)} — {formatDate(sprint.endDate)}</span>{canManage ? <Button size="sm" onClick={() => transition(sprint, "start")} disabled={Boolean(pendingId) || Boolean(active)}>{pendingId === sprint.id ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4" />} Iniciar</Button> : null}</div>
              </article>
            );
          })}
          {!planned.length ? <div className="surface col-span-full py-12 text-center"><CalendarDays className="mx-auto size-7 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">No hay sprints planeados</p><p className="mt-1 text-xs text-slate-400">Crea uno desde el backlog.</p></div> : null}
        </div>
      </section>

      <section className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6"><div><h2 className="text-sm font-bold text-slate-900">Historial</h2><p className="mt-0.5 text-xs text-slate-400">Resultados de ciclos completados</p></div><Trophy className="size-5 text-amber-500" /></div>
        <div className="divide-y divide-slate-100">
          {completed.map((sprint) => {
            const sprintTasks = tasks.filter((task) => task.sprintId === sprint.id);
            const total = sumPoints(sprintTasks);
            const done = sumPoints(sprintTasks.filter((task) => task.completedAt));
            return <div key={sprint.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6"><CheckCircle2 className="size-5 shrink-0 text-emerald-500" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{sprint.name}</p><p className="mt-0.5 truncate text-[11px] text-slate-400">{sprint.goal || "Sin objetivo"}</p></div><div className="w-full sm:w-40"><div className="flex justify-between text-[11px] text-slate-400"><span>Completado</span><strong className="text-slate-600">{done}/{total} pts</strong></div><Progress value={percent(done, total)} className="mt-1.5" barClassName="bg-emerald-500" /></div><span className="text-[11px] text-slate-400">{formatDate(sprint.completedAt)}</span></div>;
          })}
          {!completed.length ? <p className="px-6 py-10 text-center text-xs text-slate-400">El historial aparecerá cuando se complete el primer sprint.</p> : null}
        </div>
      </section>
    </div>
  );
}

function ActiveSprint({ sprint, tasks, members, canManage, pending, todayKey, onComplete }: {
  sprint: Sprint;
  tasks: TaskCard[];
  members: Person[];
  canManage: boolean;
  pending: boolean;
  todayKey: string;
  onComplete: () => void;
}) {
  const total = sumPoints(tasks);
  const doneTasks = tasks.filter((task) => task.completedAt);
  const done = sumPoints(doneTasks);
  const progress = percent(done, total);
  const overdue = tasks.filter((task) => task.dueDate && !task.completedAt && task.dueDate < todayKey).length;
  return (
    <section className="relative overflow-hidden rounded-2xl bg-[#202943] p-6 text-white shadow-xl shadow-slate-900/10 sm:p-8">
      <div className="absolute -right-24 -top-24 size-72 rounded-full bg-violet-500/25 blur-3xl" /><div className="absolute -bottom-28 left-1/3 size-72 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0 flex-1"><Badge color="#c4b5fd" className="bg-white/10">En ejecución</Badge><h2 className="mt-4 break-words text-2xl font-bold sm:text-3xl">{sprint.name}</h2><p className="mt-2 max-w-2xl break-words text-sm leading-6 text-slate-300">{sprint.goal || "Sin objetivo definido."}</p></div>{canManage ? <Button variant="secondary" onClick={onComplete} disabled={pending} className="shrink-0 border-white/10 bg-white/10 text-white hover:bg-white/15">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Completar sprint</Button> : null}</div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SprintMetric icon={Gauge} label="Avance" value={`${progress}%`} helper={`${done} de ${total} puntos`} />
          <SprintMetric icon={CheckCircle2} label="Completadas" value={String(doneTasks.length)} helper={`de ${tasks.length} tareas`} />
          <SprintMetric icon={CircleAlert} label="Vencidas" value={String(overdue)} helper={overdue ? "requieren atención" : "ninguna alerta"} warning={overdue > 0} />
          <SprintMetric icon={CalendarDays} label="Periodo" value={formatDate(sprint.endDate)} helper={`inició ${formatDate(sprint.startDate)}`} />
        </div>
        <Progress value={progress} className="mt-7 h-3 bg-white/10" barClassName="bg-gradient-to-r from-violet-400 to-cyan-300" />
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex shrink-0 -space-x-2">{members.slice(0, 5).map((person) => <Avatar key={person.id} name={person.fullName} color={person.avatarColor} size="sm" className="ring-[#202943]" />)}{members.length > 5 ? <span className="grid size-8 place-items-center rounded-full bg-white/10 text-[11px] font-bold text-slate-200 ring-2 ring-[#202943]">+{members.length - 5}</span> : null}</div><p className="min-w-0 break-words text-xs leading-5 text-slate-400 sm:text-right">El burndown y la velocidad se actualizan desde el historial de cada transición.</p></div>
      </div>
    </section>
  );
}

function SprintMetric({ icon: Icon, label, value, helper, warning = false }: { icon: typeof Gauge; label: string; value: string; helper: string; warning?: boolean }) {
  return <div className="rounded-xl border border-white/8 bg-white/6 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-slate-400"><Icon className={warning ? "size-4 text-rose-300" : "size-4 text-violet-300"} /> {label}</div><p className={warning ? "mt-3 text-2xl font-bold text-rose-200" : "mt-3 text-2xl font-bold text-white"}>{value}</p><p className="mt-1 text-[11px] text-slate-400">{helper}</p></div>;
}

function sumPoints(tasks: TaskCard[]) { return tasks.reduce((sum, task) => sum + (task.storyPoints ?? 0), 0); }
