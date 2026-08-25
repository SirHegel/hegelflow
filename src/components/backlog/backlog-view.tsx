"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Bug,
  CalendarDays,
  CheckSquare2,
  ChevronDown,
  CircleDot,
  Layers3,
  LoaderCircle,
  Plus,
  Search,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SectionHeading } from "@/components/ui/section-heading";
import { cn, formatDate, percent } from "@/lib/utils";
import type { BoardData, Person, Sprint, TaskCard, WorkspaceContext } from "@/lib/types";

const typeIcons = { EPIC: Sparkles, STORY: CircleDot, TASK: CheckSquare2, BUG: Bug };
const priorityColor = { LOW: "#64748b", MEDIUM: "#3b82f6", HIGH: "#f59e0b", URGENT: "#ef4444" };

type BacklogData = {
  board: BoardData["board"] | null;
  tasks: TaskCard[];
  sprints: Sprint[];
  members: Person[];
};

export function BacklogView({ data, context }: { data: BacklogData; context: WorkspaceContext }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const canManageSprints = context.accessLevel === "OWNER" || context.accessLevel === "ADMIN";

  const visibleTasks = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    if (!normalized) return data.tasks;
    return data.tasks.filter((task) => `${task.key} ${task.title} ${task.description}`.toLocaleLowerCase("es").includes(normalized));
  }, [data.tasks, query]);

  const activeSprint = data.sprints.find((sprint) => sprint.status === "ACTIVE") ?? null;
  const plannedSprints = data.sprints.filter((sprint) => sprint.status === "PLANNED");
  const backlogTasks = visibleTasks.filter((task) => !task.sprintId);

  async function assignSprint(task: TaskCard, sprintId: string | null) {
    setMovingId(task.id);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${task.id}/sprint`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" },
        body: JSON.stringify({ sprintId, version: task.version }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "No fue posible cambiar el sprint.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible cambiar el sprint.");
    } finally {
      setMovingId(null);
    }
  }

  async function createSprint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/sprints", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" },
        body: JSON.stringify({
          boardId: data.board?.id,
          name: form.get("name"),
          goal: form.get("goal"),
          startDate: form.get("startDate") || null,
          endDate: form.get("endDate") || null,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "No fue posible crear el sprint.");
      setShowCreateSprint(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible crear el sprint.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1380px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <SectionHeading
        eyebrow="Planificación"
        title="Backlog de producto"
        description="Prioriza el trabajo, estima su esfuerzo y prepara el siguiente sprint sin perder visibilidad del flujo Kanban."
        actions={canManageSprints ? <Button onClick={() => setShowCreateSprint(true)}><Plus className="size-4" /> Crear sprint</Button> : undefined}
      />

      <div className="surface flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100" placeholder="Buscar en el backlog…" />
        </label>
        <div className="flex items-center gap-4 px-2 text-xs text-slate-500">
          <span><strong className="text-slate-900">{data.tasks.length}</strong> elementos</span>
          <span><strong className="text-slate-900">{data.tasks.reduce((sum, task) => sum + (task.storyPoints ?? 0), 0)}</strong> puntos</span>
        </div>
      </div>

      {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {activeSprint ? (
        <SprintSection
          sprint={activeSprint}
          tasks={visibleTasks.filter((task) => task.sprintId === activeSprint.id)}
          members={data.members}
          allSprints={data.sprints}
          movingId={movingId}
          onAssign={assignSprint}
          canEdit={context.accessLevel !== "VIEWER"}
          emphasized
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 p-6 text-center">
          <Target className="mx-auto size-8 text-violet-500" />
          <p className="mt-3 text-sm font-bold text-slate-800">No hay un sprint activo</p>
          <p className="mt-1 text-xs text-slate-500">Prepara un sprint y actívalo cuando el equipo tenga objetivo y capacidad definidos.</p>
        </div>
      )}

      {plannedSprints.map((sprint) => (
        <SprintSection
          key={sprint.id}
          sprint={sprint}
          tasks={visibleTasks.filter((task) => task.sprintId === sprint.id)}
          members={data.members}
          allSprints={data.sprints}
          movingId={movingId}
          onAssign={assignSprint}
          canEdit={context.accessLevel !== "VIEWER"}
        />
      ))}

      <section className="surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-500"><Layers3 className="size-4" /></div>
            <div><h2 className="text-sm font-bold text-slate-900">Backlog</h2><p className="text-[11px] text-slate-400">Trabajo aún no comprometido</p></div>
          </div>
          <span className="text-xs font-semibold text-slate-500">{backlogTasks.length} elementos · {sumPoints(backlogTasks)} pts</span>
        </div>
        <div className="divide-y divide-slate-100">
          {backlogTasks.map((task) => (
            <BacklogRow key={task.id} task={task} members={data.members} allSprints={data.sprints} moving={movingId === task.id} onAssign={assignSprint} canEdit={context.accessLevel !== "VIEWER"} />
          ))}
          {!backlogTasks.length ? <div className="px-6 py-12 text-center"><CheckSquare2 className="mx-auto size-7 text-emerald-500" /><p className="mt-3 text-sm font-semibold text-slate-700">El backlog está despejado</p><p className="mt-1 text-xs text-slate-400">No quedan elementos sin asignar.</p></div> : null}
        </div>
      </section>

      {showCreateSprint ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <button className="absolute inset-0" onClick={() => setShowCreateSprint(false)} aria-label="Cerrar" />
          <form onSubmit={createSprint} className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-violet-600">Scrum</p><h2 className="mt-1 text-xl font-bold text-slate-950">Crear sprint</h2></div><button type="button" onClick={() => setShowCreateSprint(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="size-4" /></button></div>
            <div className="mt-6 space-y-4">
              <label className="block text-xs font-bold text-slate-600">Nombre<input name="name" required maxLength={120} placeholder={`Sprint ${data.sprints.length + 1}`} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /></label>
              <label className="block text-xs font-bold text-slate-600">Objetivo<textarea name="goal" rows={3} maxLength={2000} placeholder="¿Qué resultado concreto perseguirá el equipo?" className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-bold text-slate-600">Inicio<input name="startDate" type="date" className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" /></label>
                <label className="block text-xs font-bold text-slate-600">Fin<input name="endDate" type="date" className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" /></label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setShowCreateSprint(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />} Crear sprint</Button></div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function SprintSection({ sprint, tasks, members, allSprints, movingId, onAssign, canEdit, emphasized = false }: {
  sprint: Sprint;
  tasks: TaskCard[];
  members: Person[];
  allSprints: Sprint[];
  movingId: string | null;
  onAssign: (task: TaskCard, sprintId: string | null) => void;
  canEdit: boolean;
  emphasized?: boolean;
}) {
  const total = sumPoints(tasks);
  const done = sumPoints(tasks.filter((task) => task.completedAt));
  return (
    <details open={emphasized} className={cn("surface overflow-hidden", emphasized && "border-violet-200 ring-1 ring-violet-100")}>
      <summary className="flex cursor-pointer list-none flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-3">
          <div className={cn("grid size-9 place-items-center rounded-xl", emphasized ? "bg-violet-100 text-violet-600" : "bg-slate-100 text-slate-500")}><Target className="size-4" /></div>
          <div><div className="flex items-center gap-2"><h2 className="text-sm font-bold text-slate-900">{sprint.name}</h2><Badge color={emphasized ? "#6d5dfc" : undefined}>{emphasized ? "Activo" : "Planeado"}</Badge></div><p className="mt-0.5 max-w-xl truncate text-[11px] text-slate-400">{sprint.goal || "Sin objetivo definido"}</p></div>
        </div>
        <div className="flex items-center gap-4"><div className="hidden w-28 sm:block"><Progress value={percent(done, total)} /><p className="mt-1 text-right text-[9px] text-slate-400">{done}/{total} pts</p></div><span className="text-xs font-semibold text-slate-500">{tasks.length} elementos</span><ChevronDown className="size-4 text-slate-400" /></div>
      </summary>
      <div className="divide-y divide-slate-100 border-t border-slate-100">
        {tasks.map((task) => <BacklogRow key={task.id} task={task} members={members} allSprints={allSprints} moving={movingId === task.id} onAssign={onAssign} canEdit={canEdit} />)}
        {!tasks.length ? <p className="px-6 py-8 text-center text-xs text-slate-400">Este sprint todavía no tiene elementos.</p> : null}
      </div>
    </details>
  );
}

function BacklogRow({ task, allSprints, moving, onAssign, canEdit }: {
  task: TaskCard;
  members: Person[];
  allSprints: Sprint[];
  moving: boolean;
  onAssign: (task: TaskCard, sprintId: string | null) => void;
  canEdit: boolean;
}) {
  const TypeIcon = typeIcons[task.taskType];
  return (
    <div className="flex flex-col gap-3 px-5 py-3.5 transition hover:bg-slate-50/70 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <TypeIcon className="size-4 shrink-0" style={{ color: priorityColor[task.priority] }} />
        <span className="w-16 shrink-0 text-[10px] font-bold text-violet-600">{task.key}</span>
        <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-800">{task.title}</p><div className="mt-1 flex gap-1">{task.labels.slice(0, 2).map((label) => <span key={label.id} className="size-1.5 rounded-full" style={{ backgroundColor: label.color }} />)}</div></div>
      </div>
      <div className="flex items-center gap-3 pl-7 sm:pl-0">
        {task.dueDate ? <span className="hidden items-center gap-1 text-[10px] text-slate-400 md:inline-flex"><CalendarDays className="size-3" /> {formatDate(task.dueDate)}</span> : null}
        <div className="flex -space-x-1.5">{task.assignees.slice(0, 3).map((person) => <Avatar key={person.id} name={person.fullName} color={person.avatarColor} size="xs" />)}</div>
        <span className="w-10 text-center text-[10px] font-bold text-slate-600">{task.storyPoints ?? "—"} pts</span>
        {canEdit ? (
          <select
            aria-label={`Asignar sprint a ${task.title}`}
            value={task.sprintId ?? ""}
            disabled={moving}
            onChange={(event) => onAssign(task, event.target.value || null)}
            className="h-8 max-w-36 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-600 outline-none disabled:opacity-50"
          >
            <option value="">Backlog</option>
            {allSprints.filter((sprint) => sprint.status === "ACTIVE" || sprint.status === "PLANNED").map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}
          </select>
        ) : null}
      </div>
    </div>
  );
}

function sumPoints(tasks: TaskCard[]) {
  return tasks.reduce((sum, task) => sum + (task.storyPoints ?? 0), 0);
}
