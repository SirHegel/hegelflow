"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Circle, Flag, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { useTodayKey } from "@/hooks/use-today-key";
import { cn } from "@/lib/utils";
import type { BoardData, Sprint, TaskCard } from "@/lib/types";

const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const priorityColor = { LOW: "#64748b", MEDIUM: "#3b82f6", HIGH: "#f59e0b", URGENT: "#ef4444" };
const agendaDateFormatter = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" });

export function WorkCalendar({ tasks, sprints, board, initialTodayKey, timeZone }: { tasks: TaskCard[]; sprints: Sprint[]; board: BoardData["board"] | null; initialTodayKey: string; timeZone: string }) {
  const todayKey = useTodayKey(initialTodayKey, timeZone);
  const [month, setMonth] = useState(() => {
    const datedTask = tasks.find((task) => task.dueDate || task.startDate);
    const initial = datedTask?.dueDate ?? datedTask?.startDate ?? todayKey;
    const date = new Date(`${initial}T12:00:00`);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  const days = useMemo(() => buildMonth(month), [month]);
  const monthLabel = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(month);

  function tasksOn(day: Date) {
    const key = localDateKey(day);
    return tasks.filter((task) => task.dueDate === key || task.startDate === key);
  }

  const agendaDays = days
    .filter((day) => day.getMonth() === month.getMonth())
    .map((day) => {
      const dateKey = localDateKey(day);
      return {
        day,
        dateKey,
        tasks: tasksOn(day),
        sprintEvents: sprints.filter((sprint) => sprint.startDate === dateKey || sprint.endDate === dateKey),
      };
    })
    .filter((entry) => entry.tasks.length > 0 || entry.sprintEvents.length > 0);

  function changeMonth(delta: number) { setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1)); }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <SectionHeading eyebrow="Vista de fechas" title="Calendario" description="Coordina inicios, vencimientos y límites del sprint desde una vista compartida." actions={<Button variant="secondary" onClick={() => { const today = new Date(`${todayKey}T12:00:00`); setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); }}><CalendarDays className="size-4" /> Hoy</Button>} />

      <div className="surface overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="grid w-full grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-center gap-2 sm:flex sm:w-auto sm:gap-3"><button onClick={() => changeMonth(-1)} className="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Mes anterior"><ChevronLeft className="size-4" /></button><h2 className="min-w-0 truncate px-1 text-center text-base font-bold capitalize text-slate-900 sm:min-w-44" title={monthLabel}>{monthLabel}</h2><button onClick={() => changeMonth(1)} className="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Mes siguiente"><ChevronRight className="size-4" /></button></div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-500"><span className="inline-flex items-center gap-1"><Circle className="size-2.5 fill-blue-500 text-blue-500" /> Inicio</span><span className="inline-flex items-center gap-1"><Circle className="size-2.5 fill-amber-500 text-amber-500" /> Vencimiento</span><span className="inline-flex items-center gap-1"><Target className="size-3 text-violet-500" /> Sprint</span></div>
        </div>

        <div className="hidden xl:block">
          <div>
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/80">{weekDays.map((day) => <div key={day} className="border-r border-slate-100 px-2 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400 last:border-r-0">{day}</div>)}</div>
            <div className="grid grid-cols-7">
              {days.map((day, index) => {
                const currentMonth = day.getMonth() === month.getMonth();
                const today = localDateKey(day) === todayKey;
                const dayTasks = tasksOn(day);
                const dateKey = localDateKey(day);
                const sprintEvents = sprints.filter((sprint) => sprint.startDate === dateKey || sprint.endDate === dateKey);
                return (
                  <div key={dateKey} className={cn("min-h-32 border-b border-r border-slate-100 p-2 last:border-r-0", !currentMonth && "bg-slate-50/55 text-slate-300", index % 7 === 6 && "border-r-0")}>
                    <div className="mb-2 flex items-center justify-between"><span className={cn("grid size-7 place-items-center rounded-full text-xs font-semibold text-slate-500", today && "bg-violet-600 text-white", !currentMonth && !today && "text-slate-300")}>{day.getDate()}</span>{dayTasks.length ? <span className="text-[11px] font-semibold text-slate-400">{dayTasks.length}</span> : null}</div>
                    <div className="space-y-1.5">
                      {sprintEvents.map((sprint) => <div key={`${sprint.id}-${dateKey}`} className="flex min-w-0 items-center gap-1.5 overflow-hidden rounded-md bg-violet-50 px-2 py-1.5 text-[11px] font-bold text-violet-700"><Target className="size-3 shrink-0" /><span className="truncate" title={`${sprint.startDate === dateKey ? "Inicio" : "Fin"}: ${sprint.name}`}>{sprint.startDate === dateKey ? "Inicio" : "Fin"}: {sprint.name}</span></div>)}
                      {dayTasks.slice(0, 3).map((task) => {
                        const isStart = task.startDate === dateKey && task.dueDate !== dateKey;
                        return <Link key={`${task.id}-${isStart ? "start" : "due"}`} href={board ? `/boards/${board.id}?task=${task.id}` : "#"} className={cn("block min-w-0 overflow-hidden rounded-md border-l-2 bg-slate-50 px-2 py-1.5 transition hover:bg-white hover:shadow-sm", task.completedAt && "opacity-50")} style={{ borderLeftColor: isStart ? "#3b82f6" : priorityColor[task.priority] }} title={task.title}><p className="truncate text-[11px] font-bold text-slate-700">{task.key} · {task.title}</p><p className="mt-0.5 text-[11px] text-slate-400">{isStart ? "Inicio" : "Vence"}</p></Link>;
                      })}
                      {dayTasks.length > 3 ? <p className="px-1 text-[11px] font-semibold text-violet-600">+{dayTasks.length - 3} más</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="xl:hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
            <p className="text-xs font-bold text-slate-700">Agenda del mes</p>
            <span className="text-[11px] font-semibold text-slate-500">{agendaDays.length} fechas con actividad</span>
          </div>
          {agendaDays.length ? (
            <div className="divide-y divide-slate-100">
              {agendaDays.map(({ day, dateKey, tasks: dayTasks, sprintEvents }) => (
                <section key={dateKey} className="px-4 py-4" aria-label={agendaDateFormatter.format(day)}>
                  <div className="flex items-center justify-between gap-3">
                    <time dateTime={dateKey} className="min-w-0 break-words text-xs font-bold capitalize text-slate-800">{agendaDateFormatter.format(day)}</time>
                    <span className="shrink-0 text-[11px] font-semibold text-slate-400">{dayTasks.length + sprintEvents.length} {dayTasks.length + sprintEvents.length === 1 ? "evento" : "eventos"}</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {sprintEvents.map((sprint) => (
                      <div key={`${sprint.id}-${dateKey}`} className="flex min-w-0 items-start gap-3 rounded-xl bg-violet-50 p-3 text-violet-800">
                        <Target className="mt-0.5 size-4 shrink-0" />
                        <div className="min-w-0"><p className="break-words text-xs font-bold">{sprint.name}</p><p className="mt-0.5 text-[11px] text-violet-600">{sprint.startDate === dateKey ? "Inicio del sprint" : "Fin del sprint"}</p></div>
                      </div>
                    ))}
                    {dayTasks.map((task) => {
                      const starts = task.startDate === dateKey;
                      const ends = task.dueDate === dateKey;
                      const timing = starts && ends ? "Inicio y vencimiento" : starts ? "Inicio" : "Vencimiento";
                      return (
                        <Link key={task.id} href={board ? `/boards/${board.id}?task=${task.id}` : "#"} className={cn("flex min-w-0 items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 transition hover:border-violet-200 hover:bg-white", task.completedAt && "opacity-55")}>
                          <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: starts && !ends ? "#3b82f6" : priorityColor[task.priority] }} aria-hidden="true" />
                          <div className="min-w-0"><p className="break-words text-xs font-bold leading-5 text-slate-800">{task.key} · {task.title}</p><p className="mt-0.5 text-[11px] text-slate-500">{timing}</p></div>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : <p className="px-5 py-10 text-center text-sm text-slate-500">No hay fechas de tareas o sprints en este mes.</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <CalendarSummary label="Con fecha de inicio" value={tasks.filter((task) => task.startDate).length} color="#3b82f6" />
        <CalendarSummary label="Con vencimiento" value={tasks.filter((task) => task.dueDate).length} color="#f59e0b" />
        <CalendarSummary label="Vencidas" value={tasks.filter((task) => task.dueDate && !task.completedAt && task.dueDate < todayKey).length} color="#ef4444" />
      </div>
    </div>
  );
}

function CalendarSummary({ label, value, color }: { label: string; value: number; color: string }) { return <div className="surface flex items-center gap-4 p-4"><span className="grid size-10 place-items-center rounded-xl" style={{ color, backgroundColor: `${color}12` }}><Flag className="size-4" /></span><div><p className="text-2xl font-bold text-slate-950">{value}</p><p className="text-[11px] text-slate-400">{label}</p></div></div>; }

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildMonth(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayIndex = (first.getDay() + 6) % 7;
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - mondayIndex);
  return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
}
