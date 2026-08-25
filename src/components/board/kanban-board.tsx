"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Filter,
  KanbanSquare,
  LayoutList,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { KanbanTaskCard } from "@/components/board/task-card";
import { TaskEditor } from "@/components/board/task-editor";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTodayKey } from "@/hooks/use-today-key";
import { cn, formatDate } from "@/lib/utils";
import type { BoardColumn, BoardData, TaskCard, TaskPriority, WorkspaceContext } from "@/lib/types";

type ViewMode = "board" | "list";

export function KanbanBoard({ initialData, context, initialTodayKey, timeZone }: { initialData: BoardData; context: WorkspaceContext; initialTodayKey: string; timeZone: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState(initialData.tasks);
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<TaskPriority | "ALL">("ALL");
  const [assignee, setAssignee] = useState("ALL");
  const [view, setView] = useState<ViewMode>("board");
  const [activeTask, setActiveTask] = useState<TaskCard | null>(null);
  const [editorTask, setEditorTask] = useState<TaskCard | null | undefined>(() => {
    if (searchParams.get("new") === "task") return null;
    const taskId = searchParams.get("task");
    return taskId ? initialData.tasks.find((item) => item.id === taskId) : undefined;
  });
  const [editorColumn, setEditorColumn] = useState<BoardColumn>(
    initialData.columns.find((column) => column.category === "TODO") ?? initialData.columns[0],
  );
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const todayKey = useTodayKey(initialTodayKey, timeZone);
  const canEdit = context.accessLevel !== "VIEWER";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    return tasks.filter((task) => {
      if (priority !== "ALL" && task.priority !== priority) return false;
      if (assignee !== "ALL" && !task.assignees.some((person) => person.id === assignee)) return false;
      if (!normalizedQuery) return true;
      return `${task.key} ${task.title} ${task.description} ${task.labels.map((label) => label.name).join(" ")}`
        .toLocaleLowerCase("es")
        .includes(normalizedQuery);
    });
  }, [assignee, priority, query, tasks]);

  function openTask(task: TaskCard) {
    setEditorTask(task);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("new");
    params.set("task", task.id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function createTask(column?: BoardColumn) {
    if (!canEdit) return;
    if (column) setEditorColumn(column);
    setEditorTask(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("task");
    params.set("new", "task");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function closeEditor() {
    setEditorTask(undefined);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("new");
    params.delete("task");
    const suffix = params.toString();
    router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false });
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveTask(tasks.find((task) => task.id === event.active.id) ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    if (!canEdit || !event.over) return;
    const moving = tasks.find((task) => task.id === event.active.id);
    if (!moving) return;

    const overTask = tasks.find((task) => task.id === event.over?.id);
    const targetColumnId = overTask?.columnId ?? event.over.data.current?.columnId as string | undefined;
    if (!targetColumnId) return;
    const targetColumn = initialData.columns.find((column) => column.id === targetColumnId);
    if (!targetColumn) return;

    const beforeTaskId = overTask && overTask.id !== moving.id ? overTask.id : null;
    if (targetColumn.wipLimit) {
      const targetCount = tasks.filter((task) => task.columnId === targetColumnId && task.id !== moving.id).length;
      if (moving.columnId !== targetColumnId && targetCount >= targetColumn.wipLimit) {
        setToast({ type: "error", message: `“${targetColumn.name}” alcanzó su límite WIP de ${targetColumn.wipLimit}.` });
        return;
      }
    }

    const snapshot = tasks;
    const remaining = tasks.filter((task) => task.id !== moving.id);
    const inTarget = remaining.filter((task) => task.columnId === targetColumnId).sort((a, b) => a.position - b.position);
    const insertAt = beforeTaskId ? Math.max(0, inTarget.findIndex((task) => task.id === beforeTaskId)) : inTarget.length;
    const previous = inTarget[insertAt - 1]?.position ?? 0;
    const next = inTarget[insertAt]?.position ?? previous + 2000;
    const position = previous + (next - previous) / 2;
    const optimistic = { ...moving, columnId: targetColumnId, position };
    setTasks([...remaining, optimistic]);

    try {
      const response = await fetch(`/api/tasks/${moving.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" },
        body: JSON.stringify({ columnId: targetColumnId, beforeTaskId, version: moving.version }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "No fue posible mover la tarea.");
      if (typeof result.version === "number") {
        setTasks((current) => current.map((task) => task.id === moving.id ? { ...task, version: result.version } : task));
      }
      setToast({ type: "success", message: `Tarea movida a “${targetColumn.name}”.` });
      router.refresh();
    } catch (caught) {
      setTasks(snapshot);
      setToast({ type: "error", message: caught instanceof Error ? caught.message : "No fue posible mover la tarea." });
    }
  }

  const activeSprint = initialData.sprints.find((sprint) => sprint.status === "ACTIVE");
  const activeFilters = Number(priority !== "ALL") + Number(assignee !== "ALL") + Number(Boolean(query));

  return (
    <div className="flex min-h-[calc(100vh-4.5rem)] flex-col">
      <div className="border-b border-slate-200 bg-white px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              <span className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: initialData.board.color }} />
              <h1 className="min-w-0 break-words text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{initialData.board.name}</h1>
              <Badge className="normal-case tracking-normal">{initialData.board.methodology === "HYBRID" ? "Scrum + Kanban" : initialData.board.methodology}</Badge>
              {activeSprint ? <Badge color="#6d5dfc">{activeSprint.name}</Badge> : null}
            </div>
            <p className="mt-1.5 line-clamp-2 max-w-3xl break-words text-xs leading-5 text-slate-500 sm:line-clamp-none">{initialData.board.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex -space-x-1.5 pr-1">
              {initialData.members.slice(0, 4).map((person) => <Avatar key={person.id} name={person.fullName} color={person.avatarColor} size="sm" />)}
              {initialData.members.length > 4 ? <span className="grid size-8 place-items-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500 ring-2 ring-white">+{initialData.members.length - 4}</span> : null}
            </div>
            <Button variant="secondary" size="sm"><Users className="size-4" /> Compartir</Button>
            {canEdit ? <Button size="sm" onClick={() => createTask()}><Plus className="size-4" /> Nueva tarea</Button> : null}
            <button className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50" aria-label="Más opciones"><MoreHorizontal className="size-4" /></button>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex w-fit rounded-xl bg-slate-100 p-1">
            <button onClick={() => setView("board")} className={cn("inline-flex h-8 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition", view === "board" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}>
              <KanbanSquare className="size-4" /> Tablero
            </button>
            <button onClick={() => setView("list")} className={cn("inline-flex h-8 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition", view === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}>
              <LayoutList className="size-4" /> Lista
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-48 flex-1 lg:w-64 lg:flex-none">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-700 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100" placeholder="Filtrar tareas…" />
            </label>
            <label className="relative">
              <span className="sr-only">Prioridad</span>
              <select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority | "ALL")} className="h-9 appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-8 text-xs font-medium text-slate-600 outline-none hover:bg-slate-50">
                <option value="ALL">Toda prioridad</option>
                <option value="URGENT">Urgente</option>
                <option value="HIGH">Alta</option>
                <option value="MEDIUM">Media</option>
                <option value="LOW">Baja</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 size-4 text-slate-400" />
            </label>
            <label className="relative hidden sm:block">
              <span className="sr-only">Responsable</span>
              <select value={assignee} onChange={(event) => setAssignee(event.target.value)} className="h-9 max-w-44 appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-8 text-xs font-medium text-slate-600 outline-none hover:bg-slate-50">
                <option value="ALL">Todo el equipo</option>
                {initialData.members.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 size-4 text-slate-400" />
            </label>
            <button className="relative grid size-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50" aria-label="Más filtros">
              <SlidersHorizontal className="size-4" />
              {activeFilters ? <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-violet-600 text-[9px] font-bold text-white">{activeFilters}</span> : null}
            </button>
          </div>
        </div>
      </div>

      {view === "board" ? (
        <DndContext id={`kanban-${initialData.board.id}`} sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="app-scrollbar flex flex-1 gap-4 overflow-x-auto p-4 sm:p-6 lg:p-7">
            {initialData.columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                tasks={filteredTasks.filter((task) => task.columnId === column.id).sort((a, b) => a.position - b.position)}
                canEdit={canEdit}
                onOpen={openTask}
                onCreate={() => createTask(column)}
                todayKey={todayKey}
              />
            ))}
          </div>
          <DragOverlay>{activeTask ? <KanbanTaskCard task={activeTask} todayKey={todayKey} overlay /> : null}</DragOverlay>
        </DndContext>
      ) : (
        <TaskTable tasks={filteredTasks} columns={initialData.columns} onOpen={openTask} />
      )}

      {editorTask !== undefined ? (
        <TaskEditor
          boardId={initialData.board.id}
          task={editorTask}
          defaultColumn={editorColumn}
          members={initialData.members}
          labels={initialData.labels}
          sprints={initialData.sprints}
          canEdit={canEdit}
          onClose={closeEditor}
        />
      ) : null}

      {toast ? (
        <div className={cn("fixed bottom-5 right-5 z-[80] flex max-w-sm items-center gap-2.5 rounded-xl border bg-white px-4 py-3 text-sm font-medium shadow-xl", toast.type === "error" ? "border-rose-200 text-rose-700" : "border-emerald-200 text-emerald-700")} role="status">
          {toast.type === "error" ? <CircleAlert className="size-4 shrink-0" /> : <CheckCircle2 className="size-4 shrink-0" />}
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-2 rounded p-0.5 opacity-60 hover:opacity-100" aria-label="Cerrar notificación"><X className="size-3.5" /></button>
        </div>
      ) : null}
    </div>
  );
}

function KanbanColumn({ column, tasks, canEdit, onOpen, onCreate, todayKey }: {
  column: BoardColumn;
  tasks: TaskCard[];
  canEdit: boolean;
  onOpen: (task: TaskCard) => void;
  onCreate: () => void;
  todayKey: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${column.id}`, data: { type: "column", columnId: column.id } });
  const full = Boolean(column.wipLimit && tasks.length >= column.wipLimit);

  return (
    <section className="flex w-[300px] shrink-0 flex-col" aria-label={`${column.name}, ${tasks.length} tareas`}>
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: column.color }} />
        <h2 className="min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-wide text-slate-700" title={column.name}>{column.name}</h2>
        <span className="grid min-w-5 shrink-0 place-items-center rounded-full bg-slate-200/80 px-1.5 py-0.5 text-[11px] font-bold text-slate-500">{tasks.length}</span>
        {column.wipLimit ? <span className={cn("shrink-0 text-[11px] font-semibold", full ? "text-rose-600" : "text-slate-400")}>WIP {tasks.length}/{column.wipLimit}</span> : null}
        <button className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700" aria-label={`Opciones de ${column.name}`}><MoreHorizontal className="size-4" /></button>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-32 flex-1 flex-col gap-3 rounded-2xl border border-slate-200/70 bg-slate-100/55 p-2.5 transition",
          isOver && "border-violet-300 bg-violet-50/70 ring-2 ring-violet-100",
          full && "border-rose-200/80",
        )}
      >
        <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => <KanbanTaskCard key={task.id} task={task} todayKey={todayKey} onOpen={onOpen} disabled={!canEdit} />)}
        </SortableContext>
        {!tasks.length ? (
          <div className="grid min-h-24 place-items-center rounded-xl border border-dashed border-slate-300 text-center">
            <div><p className="text-[11px] font-medium text-slate-400">Suelta tareas aquí</p></div>
          </div>
        ) : null}
        {canEdit ? (
          <button onClick={onCreate} className="flex h-9 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-slate-400 transition hover:bg-white hover:text-violet-600 hover:shadow-sm">
            <Plus className="size-4" /> Añadir tarea
          </button>
        ) : null}
      </div>
    </section>
  );
}

function TaskTable({ tasks, columns, onOpen }: { tasks: TaskCard[]; columns: BoardColumn[]; onOpen: (task: TaskCard) => void }) {
  const columnMap = new Map(columns.map((column) => [column.id, column]));
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="surface app-scrollbar overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <tr><th className="px-5 py-3.5">Clave</th><th className="px-4 py-3.5">Tarea</th><th className="px-4 py-3.5">Estado</th><th className="px-4 py-3.5">Responsables</th><th className="px-4 py-3.5">Prioridad</th><th className="px-4 py-3.5">Puntos</th><th className="px-4 py-3.5">Vence</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.map((task) => {
              const column = columnMap.get(task.columnId);
              return (
                <tr key={task.id} onClick={() => onOpen(task)} className="cursor-pointer text-xs text-slate-600 transition hover:bg-violet-50/35">
                  <td className="whitespace-nowrap px-5 py-4 font-bold text-violet-600">{task.key}</td>
                  <td className="max-w-sm px-4 py-4"><p className="truncate font-semibold text-slate-800">{task.title}</p><p className="mt-1 truncate text-[11px] text-slate-400">{task.taskType}</p></td>
                  <td className="px-4 py-4"><Badge color={column?.color}>{column?.name ?? "—"}</Badge></td>
                  <td className="px-4 py-4"><div className="flex -space-x-1.5">{task.assignees.map((person) => <Avatar key={person.id} name={person.fullName} color={person.avatarColor} size="xs" />)}</div></td>
                  <td className="px-4 py-4 font-semibold">{task.priority}</td>
                  <td className="px-4 py-4">{task.storyPoints ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-4">{formatDate(task.dueDate)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!tasks.length ? <div className="py-16 text-center"><Filter className="mx-auto size-7 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">No hay resultados</p><p className="mt-1 text-xs text-slate-400">Ajusta los filtros de la vista.</p></div> : null}
      </div>
    </div>
  );
}
