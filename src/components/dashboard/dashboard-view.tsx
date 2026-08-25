import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  FolderKanban,
  Layers3,
  Plus,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { percent, formatDate } from "@/lib/utils";
import type { WorkspaceContext } from "@/lib/types";

type DashboardData = {
  metrics: {
    totalOpen: number;
    inProgress: number;
    completedThisWeek: number;
    overdue: number;
    sprintPoints: number;
    completedSprintPoints: number;
  };
  activeSprint: {
    id: string;
    name: string;
    goal: string | null;
    startDate: string | null;
    endDate: string | null;
    daysRemaining: number;
  } | null;
  workload: Array<{
    id: string;
    fullName: string;
    workRole: string;
    avatarColor: string;
    capacityPoints: number;
    assignedPoints: number;
    taskCount: number;
  }>;
  dueSoon: Array<{
    id: string;
    key: string;
    title: string;
    dueDate: string;
    priority: string;
    boardId: string;
    assigneeName: string | null;
  }>;
  boards: Array<{
    id: string;
    name: string;
    description: string;
    methodology: "KANBAN" | "SCRUM" | "HYBRID";
    color: string;
    openTasks: number;
    completedTasks: number;
  }>;
};

export function DashboardView({ context, data }: { context: WorkspaceContext; data: DashboardData }) {
  const firstName = context.fullName.split(" ")[0];
  const sprintProgress = percent(data.metrics.completedSprintPoints, data.metrics.sprintPoints);
  const today = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const metricCards = [
    {
      label: "Trabajo abierto",
      value: data.metrics.totalOpen,
      helper: "en todos los tableros",
      icon: Layers3,
      color: "text-violet-600",
      iconBg: "bg-violet-50",
    },
    {
      label: "En ejecución",
      value: data.metrics.inProgress,
      helper: "en curso o revisión",
      icon: Clock3,
      color: "text-amber-600",
      iconBg: "bg-amber-50",
    },
    {
      label: "Completadas",
      value: data.metrics.completedThisWeek,
      helper: "durante esta semana",
      icon: CheckCircle2,
      color: "text-emerald-600",
      iconBg: "bg-emerald-50",
    },
    {
      label: "Vencidas",
      value: data.metrics.overdue,
      helper: data.metrics.overdue ? "requieren atención" : "todo bajo control",
      icon: CircleAlert,
      color: data.metrics.overdue ? "text-rose-600" : "text-slate-500",
      iconBg: data.metrics.overdue ? "bg-rose-50" : "bg-slate-100",
    },
  ];

  return (
    <div className="mx-auto max-w-[1540px] space-y-7 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold capitalize text-slate-400">{today}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Buenos días, {firstName}</h1>
          <p className="mt-1.5 text-sm text-slate-500">Aquí tienes el pulso del equipo y del trabajo prioritario.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/reports">
            <Button variant="secondary"><TrendingUp className="size-4" /> Ver reportes</Button>
          </Link>
          {data.boards[0] ? (
            <Link href={`/boards/${data.boards[0].id}?new=task`}>
              <Button><Plus className="size-4" /> Nueva tarea</Button>
            </Link>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores principales">
        {metricCards.map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.label} className="surface p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500">{metric.label}</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{metric.value}</p>
                </div>
                <div className={`grid size-10 place-items-center rounded-xl ${metric.iconBg}`}>
                  <Icon className={`size-5 ${metric.color}`} />
                </div>
              </div>
              <p className="mt-3 text-[11px] text-slate-400">{metric.helper}</p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.75fr)]">
        <div className="surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Tableros activos</h2>
              <p className="mt-0.5 text-xs text-slate-400">Trabajo agrupado por iniciativa</p>
            </div>
            <button className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50" aria-label="Crear tablero">
              <Plus className="size-4" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {data.boards.length ? data.boards.map((board) => {
              const total = board.openTasks + board.completedTasks;
              const completed = percent(board.completedTasks, total);
              return (
                <Link key={board.id} href={`/boards/${board.id}`} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50/80 sm:px-6">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl text-white shadow-sm" style={{ backgroundColor: board.color }}>
                    <FolderKanban className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-bold text-slate-900">{board.name}</h3>
                      <Badge>{board.methodology === "HYBRID" ? "Scrum + Kanban" : board.methodology}</Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-400">{board.description}</p>
                    <div className="mt-3 flex items-center gap-3">
                      <Progress value={completed} className="max-w-48 flex-1" />
                      <span className="text-[11px] font-semibold text-slate-500">{completed}%</span>
                      <span className="hidden text-[11px] text-slate-400 sm:inline">{board.openTasks} abiertas</span>
                    </div>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-violet-500" />
                </Link>
              );
            }) : (
              <div className="px-6 py-12 text-center">
                <FolderKanban className="mx-auto size-8 text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-700">Aún no hay tableros</p>
                <p className="mt-1 text-xs text-slate-400">Crea el primero para empezar a organizar el trabajo.</p>
              </div>
            )}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-[#202943] p-6 text-white shadow-lg shadow-slate-900/10">
          <div className="absolute -right-16 -top-16 size-48 rounded-full bg-violet-500/25 blur-2xl" />
          <div className="absolute -bottom-20 left-8 size-48 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 rounded-lg bg-white/8 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-200">
                <Sparkles className="size-3" /> Sprint activo
              </span>
              {data.activeSprint ? <span className="text-xs text-slate-400">{data.activeSprint.daysRemaining} días restantes</span> : null}
            </div>
            {data.activeSprint ? (
              <>
                <h2 className="mt-6 text-2xl font-bold">{data.activeSprint.name}</h2>
                <p className="mt-2 min-h-12 text-sm leading-6 text-slate-300">{data.activeSprint.goal ?? "Sin objetivo definido."}</p>
                <div className="mt-7 flex items-end justify-between">
                  <div>
                    <p className="text-4xl font-bold tracking-tight">{sprintProgress}%</p>
                    <p className="mt-1 text-xs text-slate-400">{data.metrics.completedSprintPoints} de {data.metrics.sprintPoints} puntos</p>
                  </div>
                  <div className="grid size-14 place-items-center rounded-2xl bg-white/8">
                    <span className="text-sm font-bold text-violet-200">SP</span>
                  </div>
                </div>
                <Progress value={sprintProgress} className="mt-5 h-2.5 bg-white/10" barClassName="bg-gradient-to-r from-violet-400 to-cyan-300" />
                <div className="mt-5 flex items-center justify-between border-t border-white/8 pt-4 text-xs text-slate-400">
                  <span>{formatDate(data.activeSprint.startDate)} — {formatDate(data.activeSprint.endDate)}</span>
                  <Link href="/sprints" className="inline-flex items-center gap-1 font-semibold text-violet-200 hover:text-white">Abrir <ArrowRight className="size-3" /></Link>
                </div>
              </>
            ) : (
              <div className="py-10 text-center">
                <CalendarClock className="mx-auto size-9 text-violet-300" />
                <h2 className="mt-4 text-lg font-bold">No hay sprint activo</h2>
                <p className="mt-2 text-sm text-slate-400">Planifica un objetivo y asigna capacidad al equipo.</p>
                <Link href="/sprints" className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-violet-200">Planificar sprint <ArrowRight className="size-3" /></Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(350px,0.9fr)]">
        <div className="surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Carga del equipo</h2>
              <p className="mt-0.5 text-xs text-slate-400">Puntos abiertos frente a la capacidad</p>
            </div>
            <Link href="/team" className="text-xs font-semibold text-violet-600 hover:text-violet-700">Ver equipo</Link>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            {data.workload.map((person) => {
              const utilization = percent(person.assignedPoints, person.capacityPoints);
              const overloaded = utilization > 100;
              return (
                <article key={person.id} className="rounded-xl border border-slate-100 bg-slate-50/65 p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={person.fullName} color={person.avatarColor} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-900">{person.fullName}</p>
                      <p className="truncate text-[10px] text-slate-400">{person.workRole}</p>
                    </div>
                    <span className={`text-xs font-bold ${overloaded ? "text-rose-600" : "text-slate-700"}`}>{utilization}%</span>
                  </div>
                  <Progress value={utilization} className="mt-4" barClassName={overloaded ? "bg-rose-500" : utilization > 75 ? "bg-amber-500" : "bg-violet-500"} />
                  <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                    <span>{person.taskCount} tareas</span>
                    <span>{person.assignedPoints}/{person.capacityPoints} pts</span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Próximos vencimientos</h2>
              <p className="mt-0.5 text-xs text-slate-400">Fechas que necesitan seguimiento</p>
            </div>
            <CalendarClock className="size-5 text-slate-400" />
          </div>
          <div className="divide-y divide-slate-100 px-5 sm:px-6">
            {data.dueSoon.length ? data.dueSoon.map((task) => {
              const overdue = new Date(`${task.dueDate}T23:59:59`) < new Date();
              return (
                <Link key={task.id} href={`/boards/${task.boardId}?task=${task.id}`} className="group flex items-center gap-3 py-3.5">
                  <div className={`grid size-9 shrink-0 place-items-center rounded-xl ${overdue ? "bg-rose-50 text-rose-600" : "bg-violet-50 text-violet-600"}`}>
                    <CalendarClock className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-800 group-hover:text-violet-700">{task.title}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">{task.key} · {task.assigneeName ?? "Sin asignar"}</p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold ${overdue ? "text-rose-600" : "text-slate-500"}`}>{formatDate(task.dueDate)}</span>
                </Link>
              );
            }) : (
              <div className="py-10 text-center">
                <CheckCircle2 className="mx-auto size-8 text-emerald-500" />
                <p className="mt-3 text-sm font-semibold text-slate-700">Sin vencimientos pendientes</p>
                <p className="mt-1 text-xs text-slate-400">El equipo está al día.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="flex items-center justify-between border-t border-slate-200 pt-5 text-[11px] text-slate-400">
        <span>HegelFlow · {context.workspaceName}</span>
        <span className="inline-flex items-center gap-1.5"><Users className="size-3.5" /> {data.workload.length} perfiles activos</span>
      </footer>
    </div>
  );
}
