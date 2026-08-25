"use client";

import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import {
  Bug,
  CalendarDays,
  CheckSquare2,
  CircleAlert,
  CircleDot,
  Flag,
  GripVertical,
  Link2,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import type { TaskCard as TaskCardType } from "@/lib/types";

const priorityMeta = {
  LOW: { label: "Baja", className: "text-slate-500" },
  MEDIUM: { label: "Media", className: "text-blue-600" },
  HIGH: { label: "Alta", className: "text-amber-600" },
  URGENT: { label: "Urgente", className: "text-rose-600" },
};

const typeMeta = {
  EPIC: { label: "Épica", icon: Sparkles, className: "text-violet-600" },
  STORY: { label: "Historia", icon: CircleDot, className: "text-emerald-600" },
  TASK: { label: "Tarea", icon: CheckSquare2, className: "text-blue-600" },
  BUG: { label: "Error", icon: Bug, className: "text-rose-600" },
};

export function KanbanTaskCard({ task, todayKey, onOpen, disabled = false, overlay = false }: {
  task: TaskCardType;
  todayKey: string;
  onOpen?: (task: TaskCardType) => void;
  disabled?: boolean;
  overlay?: boolean;
}) {
  const sortable = useSortable({ id: task.id, disabled: disabled || overlay, data: { type: "task", task } });
  const type = typeMeta[task.taskType];
  const TypeIcon = type.icon;
  const priority = priorityMeta[task.priority];
  const overdue = Boolean(task.dueDate && !task.completedAt && task.dueDate < todayKey);

  const style = overlay ? undefined : {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <article
      ref={overlay ? undefined : sortable.setNodeRef}
      style={style}
      {...(overlay ? {} : sortable.attributes)}
      {...(overlay ? {} : sortable.listeners)}
      onClick={() => onOpen?.(task)}
      className={cn(
        "group relative cursor-pointer rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-[0_1px_2px_rgba(16,24,40,.035)] transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-lg hover:shadow-slate-900/6",
        sortable.isDragging && "z-10 opacity-35",
        overlay && "w-[284px] rotate-2 border-violet-300 shadow-2xl",
      )}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <span className={cn("inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide", type.className)} title={type.label}>
          <TypeIcon className="size-3.5" /> {task.key}
        </span>
        <span className={cn("ml-auto inline-flex items-center gap-1 text-[11px] font-bold", priority.className)} title={`Prioridad ${priority.label}`}>
          <Flag className="size-3" /> {priority.label}
        </span>
        {!disabled ? <GripVertical className="size-3.5 text-slate-300 opacity-0 transition group-hover:opacity-100" aria-hidden /> : null}
      </div>

      <h3 className="break-words text-[13px] font-semibold leading-[1.42] text-slate-800">{task.title}</h3>

      {task.labels.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {task.labels.slice(0, 3).map((label) => <Badge key={label.id} color={label.color}>{label.name}</Badge>)}
          {task.labels.length > 3 ? <Badge>+{task.labels.length - 3}</Badge> : null}
        </div>
      ) : null}

      {(task.checklistTotal > 0 || task.commentCount > 0 || task.blockerCount > 0 || task.dueDate) ? (
        <div className="mt-3 flex flex-wrap items-center gap-2.5 text-[11px] font-medium text-slate-400">
          {task.dueDate ? (
            <span className={cn("inline-flex items-center gap-1", overdue && "rounded-md bg-rose-50 px-1.5 py-1 font-bold text-rose-600")}>
              {overdue ? <CircleAlert className="size-3" /> : <CalendarDays className="size-3" />}
              {formatDate(task.dueDate)}
            </span>
          ) : null}
          {task.checklistTotal > 0 ? (
            <span className={cn("inline-flex items-center gap-1", task.checklistDone === task.checklistTotal && "text-emerald-600")}>
              <CheckSquare2 className="size-3" /> {task.checklistDone}/{task.checklistTotal}
            </span>
          ) : null}
          {task.commentCount > 0 ? <span className="inline-flex items-center gap-1"><MessageSquareText className="size-3" /> {task.commentCount}</span> : null}
          {task.blockerCount > 0 ? <span className="inline-flex items-center gap-1 text-rose-600"><Link2 className="size-3" /> {task.blockerCount}</span> : null}
        </div>
      ) : null}

      <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-3">
        <div className="flex -space-x-1.5">
          {task.assignees.slice(0, 3).map((person) => <Avatar key={person.id} name={person.fullName} color={person.avatarColor} size="xs" />)}
          {!task.assignees.length ? <span className="grid size-6 place-items-center rounded-full border border-dashed border-slate-300 text-[11px] font-bold text-slate-400">?</span> : null}
        </div>
        {task.storyPoints !== null ? <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">{task.storyPoints} pts</span> : null}
      </div>
    </article>
  );
}
