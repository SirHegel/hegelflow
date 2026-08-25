"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Archive, CalendarDays, Check, LoaderCircle, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BoardColumn, Label, Person, Sprint, TaskCard, TaskPriority, TaskType } from "@/lib/types";

type TaskEditorProps = {
  boardId: string;
  task: TaskCard | null;
  defaultColumn: BoardColumn;
  members: Person[];
  labels: Label[];
  sprints: Sprint[];
  canEdit: boolean;
  onClose: () => void;
};

const inputClass = "mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-50 disabled:text-slate-500";
const labelClass = "block text-[11px] font-bold uppercase tracking-wide text-slate-500";

export function TaskEditor({ boardId, task, defaultColumn, members, labels, sprints, canEdit, onClose }: TaskEditorProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(task?.assignees.map((member) => member.id) ?? []);
  const [selectedLabels, setSelectedLabels] = useState<string[]>(task?.labels.map((label) => label.id) ?? []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const storyPoints = form.get("storyPoints")?.toString();
    const body = {
      boardId,
      columnId: task?.columnId ?? defaultColumn.id,
      title: form.get("title")?.toString().trim(),
      description: form.get("description")?.toString().trim() ?? "",
      taskType: form.get("taskType") as TaskType,
      priority: form.get("priority") as TaskPriority,
      storyPoints: storyPoints ? Number(storyPoints) : null,
      startDate: form.get("startDate")?.toString() || null,
      dueDate: form.get("dueDate")?.toString() || null,
      sprintId: form.get("sprintId")?.toString() || null,
      assigneeIds: selectedAssignees,
      labelIds: selectedLabels,
      ...(task ? { version: task.version } : {}),
    };

    try {
      const response = await fetch(task ? `/api/tasks/${task.id}` : "/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "No fue posible guardar la tarea.");
      router.refresh();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ocurrió un error inesperado.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveTask() {
    if (!task || !canEdit || !window.confirm("¿Archivar esta tarea? Podrá conservarse en el historial.")) return;
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${task.id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" },
        body: JSON.stringify({ version: task.version }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "No fue posible archivar la tarea.");
      router.refresh();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ocurrió un error inesperado.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-slate-950/40 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label={task ? `Editar ${task.key}` : "Crear tarea"} onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
      <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Cerrar editor" />
      <div className="app-scrollbar relative h-full w-full max-w-2xl overflow-y-auto bg-[#fafafd] shadow-2xl">
        <div className="sticky top-0 z-10 flex h-18 items-center justify-between border-b border-slate-200 bg-white px-5 shadow-[0_1px_0_rgba(15,23,42,0.02)] sm:px-7">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-600">{task ? task.key : "Nueva tarea"}</p>
            <h2 className="mt-0.5 text-base font-bold text-slate-900">{task ? "Detalles de la tarea" : "Añadir al flujo"}</h2>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-800" aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-6 p-5 sm:p-7">
          {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

          <section className="surface p-5">
            <label className={labelClass} htmlFor="task-title">Título</label>
            <input
              id="task-title"
              name="title"
              defaultValue={task?.title}
              required
              minLength={2}
              maxLength={240}
              disabled={!canEdit}
              className="mt-2 w-full border-0 bg-transparent p-0 text-lg font-bold text-slate-950 outline-none placeholder:text-slate-300"
              placeholder="¿Qué hay que lograr?"
            />
            <div className="mt-5">
              <label className={labelClass} htmlFor="task-description">Descripción</label>
              <textarea
                id="task-description"
                name="description"
                defaultValue={task?.description}
                rows={6}
                maxLength={20000}
                disabled={!canEdit}
                className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100"
                placeholder="Añade contexto, criterios de aceptación y enlaces relevantes…"
              />
            </div>
          </section>

          <section className="surface p-5">
            <h3 className="text-sm font-bold text-slate-900">Planificación</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>Tipo
                <select name="taskType" defaultValue={task?.taskType ?? "TASK"} disabled={!canEdit} className={inputClass}>
                  <option value="EPIC">Épica</option>
                  <option value="STORY">Historia</option>
                  <option value="TASK">Tarea</option>
                  <option value="BUG">Error</option>
                </select>
              </label>
              <label className={labelClass}>Prioridad
                <select name="priority" defaultValue={task?.priority ?? "MEDIUM"} disabled={!canEdit} className={inputClass}>
                  <option value="LOW">Baja</option>
                  <option value="MEDIUM">Media</option>
                  <option value="HIGH">Alta</option>
                  <option value="URGENT">Urgente</option>
                </select>
              </label>
              <label className={labelClass}>Story points
                <input name="storyPoints" type="number" min="0" max="100" defaultValue={task?.storyPoints ?? ""} disabled={!canEdit} className={inputClass} placeholder="Ej. 5" />
              </label>
              <label className={labelClass}>Sprint
                <select name="sprintId" defaultValue={task?.sprintId ?? ""} disabled={!canEdit} className={inputClass}>
                  <option value="">Backlog (sin sprint)</option>
                  {sprints.filter((sprint) => sprint.status !== "COMPLETED" && sprint.status !== "CANCELLED").map((sprint) => (
                    <option key={sprint.id} value={sprint.id}>{sprint.name} · {sprint.status === "ACTIVE" ? "Activo" : "Planeado"}</option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>Fecha de inicio
                <span className="relative block">
                  <CalendarDays className="pointer-events-none absolute left-3 top-4 size-4 text-slate-400" />
                  <input name="startDate" type="date" defaultValue={task?.startDate ?? ""} disabled={!canEdit} className={cn(inputClass, "pl-9")} />
                </span>
              </label>
              <label className={labelClass}>Fecha límite
                <span className="relative block">
                  <CalendarDays className="pointer-events-none absolute left-3 top-4 size-4 text-slate-400" />
                  <input name="dueDate" type="date" defaultValue={task?.dueDate ?? ""} disabled={!canEdit} className={cn(inputClass, "pl-9")} />
                </span>
              </label>
            </div>
          </section>

          <section className="surface p-5">
            <h3 className="text-sm font-bold text-slate-900">Responsables</h3>
            <p className="mt-1 text-xs text-slate-400">Una tarea puede tener más de un responsable.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {members.map((member) => {
                const active = selectedAssignees.includes(member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setSelectedAssignees((current) => active ? current.filter((id) => id !== member.id) : [...current, member.id])}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3 text-left transition",
                      active ? "border-violet-300 bg-violet-50" : "border-slate-200 bg-white hover:border-slate-300",
                    )}
                  >
                    <Avatar name={member.fullName} color={member.avatarColor} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-slate-800">{member.fullName}</span>
                      <span className="block truncate text-[11px] text-slate-400">{member.workRole}</span>
                    </span>
                    <span className={cn("grid size-5 place-items-center rounded-full border", active ? "border-violet-500 bg-violet-500 text-white" : "border-slate-300 text-transparent")}>
                      <Check className="size-3" />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="surface p-5">
            <h3 className="text-sm font-bold text-slate-900">Etiquetas</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {labels.map((label) => {
                const active = selectedLabels.includes(label.id);
                return (
                  <button
                    key={label.id}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setSelectedLabels((current) => active ? current.filter((id) => id !== label.id) : [...current, label.id])}
                    className={cn("rounded-lg border p-0.5 transition", active ? "border-violet-400 ring-2 ring-violet-100" : "border-transparent")}
                  >
                    <Badge color={label.color} className="px-3 py-1.5">{active ? "✓ " : ""}{label.name}</Badge>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
            {task && canEdit ? (
              <Button type="button" variant="ghost" onClick={archiveTask} disabled={deleting || saving} className="text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                {deleting ? <LoaderCircle className="size-4 animate-spin" /> : <Archive className="size-4" />} Archivar
              </Button>
            ) : <span />}
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
              {canEdit ? <Button type="submit" disabled={saving || deleting}>{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} {task ? "Guardar cambios" : "Crear tarea"}</Button> : null}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
