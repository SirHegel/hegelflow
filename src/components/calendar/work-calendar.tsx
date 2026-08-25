"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Circle, Flag, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { cn } from "@/lib/utils";
import type { BoardData, Sprint, TaskCard } from "@/lib/types";

const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const priorityColor = { LOW: "#64748b", MEDIUM: "#3b82f6", HIGH: "#f59e0b", URGENT: "#ef4444" };

export function WorkCalendar({ tasks, sprints, board }: { tasks: TaskCard[]; sprints: Sprint[]; board: BoardData["board"] | null }) {
  const [month, setMonth] = useState(() => {
    const datedTask = tasks.find((task) => task.dueDate || task.startDate);
    const initial = datedTask?.dueDate ?? datedTask?.startDate;
    const date = initial ? new Date(`${initial}T12:00:00`) : new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  const days = useMemo(() => buildMonth(month), [month]);
  const monthLabel = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(month);

  function tasksOn(day: Date) {
    const key = localDateKey(day);
    return tasks.filter((task) => task.dueDate === key || task.startDate === key);
  }

  function changeMonth(delta: number) { setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1)); }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <SectionHeading eyebrow="Vista de fechas" title="Calendario" description="Coordina inicios, vencimientos y límites del sprint desde una vista compartida." actions={<Button variant="secondary" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}><CalendarDays className="size-4" /> Hoy</Button>} />

      <div className="surface overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3"><button onClick={() => changeMonth(-1)} className="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Mes anterior"><ChevronLeft className="size-4" /></button><h2 className="min-w-44 text-center text-base font-bold capitalize text-slate-900">{monthLabel}</h2><button onClick={() => changeMonth(1)} className="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Mes siguiente"><ChevronRight className="size-4" /></button></div>
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold text-slate-500"><span className="inline-flex items-center gap-1"><Circle className="size-2.5 fill-blue-500 text-blue-500" /> Inicio</span><span className="inline-flex items-center gap-1"><Circle className="size-2.5 fill-amber-500 text-amber-500" /> Vencimiento</span><span className="inline-flex items-center gap-1"><Target className="size-3 text-violet-500" /> Sprint</span></div>
        </div>

        <div className="app-scrollbar overflow-x-auto">
          <div className="min-w-[840px]">
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/80">{weekDays.map((day) => <div key={day} className="border-r border-slate-100 px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 last:border-r-0">{day}</div>)}</div>
            <div className="grid grid-cols-7">
              {days.map((day, index) => {
                const currentMonth = day.getMonth() === month.getMonth();
                const today = localDateKey(day) === localDateKey(new Date());
                const dayTasks = tasksOn(day);
                const dateKey = localDateKey(day);
                const sprintEvents = sprints.filter((sprint) => sprint.startDate === dateKey || sprint.endDate === dateKey);
                return (
                  <div key={dateKey} className={cn("min-h-32 border-b border-r border-slate-100 p-2 last:border-r-0", !currentMonth && "bg-slate-50/55 text-slate-300", index % 7 === 6 && "border-r-0")}>
                    <div className="mb-2 flex items-center justify-between"><span className={cn("grid size-7 place-items-center rounded-full text-xs font-semibold text-slate-500", today && "bg-violet-600 text-white", !currentMonth && !today && "text-slate-300")}>{day.getDate()}</span>{dayTasks.length ? <span className="text-[9px] font-semibold text-slate-400">{dayTasks.length}</span> : null}</div>
                    <div className="space-y-1.5">
                      {sprintEvents.map((sprint) => <div key={`${sprint.id}-${dateKey}`} className="flex items-center gap-1.5 rounded-md bg-violet-50 px-2 py-1.5 text-[9px] font-bold text-violet-700"><Target className="size-3" /><span className="truncate">{sprint.startDate === dateKey ? "Inicio" : "Fin"}: {sprint.name}</span></div>)}
                      {dayTasks.slice(0, 3).map((task) => {
                        const isStart = task.startDate === dateKey && task.dueDate !== dateKey;
                        return <Link key={`${task.id}-${isStart ? "start" : "due"}`} href={board ? `/boards/${board.id}?task=${task.id}` : "#"} className={cn("block rounded-md border-l-2 bg-slate-50 px-2 py-1.5 transition hover:bg-white hover:shadow-sm", task.completedAt && "opacity-50")} style={{ borderLeftColor: isStart ? "#3b82f6" : priorityColor[task.priority] }} title={task.title}><p className="truncate text-[9px] font-bold text-slate-700">{task.key} · {task.title}</p><p className="mt-0.5 text-[8px] text-slate-400">{isStart ? "Inicio" : "Vence"}</p></Link>;
                      })}
                      {dayTasks.length > 3 ? <p className="px-1 text-[9px] font-semibold text-violet-600">+{dayTasks.length - 3} más</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <CalendarSummary label="Con fecha de inicio" value={tasks.filter((task) => task.startDate).length} color="#3b82f6" />
        <CalendarSummary label="Con vencimiento" value={tasks.filter((task) => task.dueDate).length} color="#f59e0b" />
        <CalendarSummary label="Vencidas" value={tasks.filter((task) => task.dueDate && !task.completedAt && new Date(`${task.dueDate}T23:59:59`) < new Date()).length} color="#ef4444" />
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
