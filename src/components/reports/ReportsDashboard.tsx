"use client";

import { useId, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock3,
  Gauge,
  Layers3,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
  type TooltipValueType,
} from "recharts";
import { cn } from "@/lib/utils";
import type {
  BurndownDatum,
  PriorityBreakdownDatum,
  ReportsDashboardProps,
  StatusBreakdownDatum,
  VelocityDatum,
} from "./report-types";

export type {
  BurndownDatum,
  CycleTimeMetrics,
  PriorityBreakdownDatum,
  ReportData,
  ReportsDashboardProps,
  StatusBreakdownDatum,
  VelocityDatum,
} from "./report-types";

const numberFormatter = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });
const compactNumberFormatter = new Intl.NumberFormat("es-CO", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const shortDateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const longDateFormatter = new Intl.DateTimeFormat("es-CO", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const fallbackStatusColors = ["#6d5dfc", "#3b82f6", "#f59e0b", "#a855f7", "#10b981", "#64748b"];

const priorityConfig: Record<string, { label: string; color: string }> = {
  URGENT: { label: "Urgente", color: "#ef4444" },
  HIGH: { label: "Alta", color: "#f97316" },
  MEDIUM: { label: "Media", color: "#f59e0b" },
  LOW: { label: "Baja", color: "#3b82f6" },
};

type NormalizedPriorityDatum = PriorityBreakdownDatum & {
  label: string;
  color: string;
};

type AccessibleTooltipProps = Partial<TooltipContentProps<TooltipValueType, string | number>> & {
  names?: Record<string, string>;
  labelFormatter?: (label: string | number) => string;
  valueFormatter?: (value: TooltipValueType, name: string) => string;
};

function finite(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function formatNumber(value: number) {
  return numberFormatter.format(finite(value));
}

function formatCompactNumber(value: number) {
  return compactNumberFormatter.format(finite(value));
}

function parseDay(value: string) {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDay(value: string, formatter = shortDateFormatter) {
  const date = parseDay(value);
  return date ? formatter.format(date) : value;
}

function percent(value: number, total: number, clamp = true) {
  if (total <= 0) return 0;
  const result = Math.round((value / total) * 100);
  return clamp ? Math.min(100, Math.max(0, result)) : Math.max(0, result);
}

function tooltipValue(value: TooltipValueType) {
  if (Array.isArray(value)) return value.map(String).join(" – ");
  if (typeof value === "number") return formatNumber(value);
  return String(value);
}

function AccessibleTooltip({
  active,
  label,
  payload,
  names = {},
  labelFormatter,
  valueFormatter,
}: AccessibleTooltipProps) {
  const entries = payload?.filter((entry) => entry.value !== undefined && entry.value !== null && !entry.hide) ?? [];
  if (!active || entries.length === 0) return null;

  const rawLabel = typeof label === "number" || typeof label === "string" ? label : "";
  const formattedLabel = labelFormatter ? labelFormatter(rawLabel) : String(rawLabel);

  return (
    <div
      role="tooltip"
      aria-live="polite"
      className="min-w-36 rounded-xl border border-slate-200/90 bg-white/95 px-3 py-2.5 shadow-xl shadow-slate-900/10 backdrop-blur"
    >
      {formattedLabel ? <p className="mb-1.5 text-[11px] font-bold text-slate-800">{formattedLabel}</p> : null}
      <ul className="space-y-1.5">
        {entries.map((entry, index) => {
          const rawName = String(entry.name ?? entry.dataKey ?? "Valor");
          const name = names[rawName] ?? rawName;
          const value = entry.value ?? 0;
          const color = entry.color ?? entry.stroke ?? entry.fill ?? "#6d5dfc";

          return (
            <li key={`${rawName}-${index}`} className="flex items-center justify-between gap-4 text-[11px]">
              <span className="flex min-w-0 items-center gap-2 text-slate-500">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                <span className="truncate">{name}</span>
              </span>
              <span className="font-bold tabular-nums text-slate-900">
                {valueFormatter ? valueFormatter(value, rawName) : tooltipValue(value)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  accent: "violet" | "blue" | "emerald" | "amber";
}) {
  const styles = {
    violet: "bg-violet-50 text-violet-600 ring-violet-100",
    blue: "bg-blue-50 text-blue-600 ring-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    amber: "bg-amber-50 text-amber-600 ring-amber-100",
  };

  return (
    <article className="surface min-w-0 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-[1.75rem]">{value}</p>
          <p className="mt-1 truncate text-xs text-slate-500" title={detail}>{detail}</p>
        </div>
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl ring-1", styles[accent])} aria-hidden="true">
          {icon}
        </span>
      </div>
    </article>
  );
}

function ChartCard({
  id,
  title,
  description,
  badge,
  children,
  className,
}: {
  id: string;
  title: string;
  description: string;
  badge?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article className={cn("surface min-w-0 overflow-hidden", className)} aria-labelledby={`${id}-title`}>
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-sm font-bold text-slate-950">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
        {badge ? (
          <span className="w-fit shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
            {badge}
          </span>
        ) : null}
      </div>
      {children}
    </article>
  );
}

function EmptyChart({ title, detail, icon = <BarChart3 className="size-5" /> }: { title: string; detail: string; icon?: ReactNode }) {
  return (
    <div className="grid min-h-64 place-items-center px-6 py-10 text-center" role="status">
      <div className="max-w-xs">
        <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-slate-100 text-slate-400" aria-hidden="true">
          {icon}
        </span>
        <p className="mt-3 text-sm font-bold text-slate-800">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

function AccessibleTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: readonly string[];
  rows: readonly (readonly (string | number)[])[];
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>{headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => cellIndex === 0
              ? <th key={cellIndex} scope="row">{cell}</th>
              : <td key={cellIndex}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BurndownChartPanel({ data, gradientId }: { data: readonly BurndownDatum[]; gradientId: string }) {
  if (data.length === 0) {
    return <EmptyChart title="No hay un sprint activo" detail="Inicia un sprint con fechas y puntos estimados para generar su burndown." icon={<TrendingUp className="size-5" />} />;
  }

  if (!data.some((item) => item.ideal > 0 || item.remaining > 0)) {
    return <EmptyChart title="Sprint sin puntos estimados" detail="Asigna story points al trabajo del sprint para trazar el descenso ideal y el restante." icon={<TrendingUp className="size-5" />} />;
  }

  return (
    <figure className="px-2 pb-3 pt-5 sm:px-4" aria-labelledby="burndown-title">
      <div className="h-72 w-full sm:h-80">
        <ResponsiveContainer width="100%" height="100%" debounce={80}>
          <ComposedChart data={data} accessibilityLayer margin={{ top: 8, right: 10, bottom: 4, left: -10 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6d5dfc" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#6d5dfc" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#edf0f5" strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              minTickGap={24}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickFormatter={(value: string) => formatDay(value)}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              width={42}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
            />
            <Tooltip
              cursor={{ stroke: "#c4b5fd", strokeDasharray: "4 4" }}
              content={(
                <AccessibleTooltip
                  names={{ remaining: "Trabajo restante", ideal: "Línea ideal" }}
                  labelFormatter={(label) => formatDay(String(label), longDateFormatter)}
                  valueFormatter={(value) => `${tooltipValue(value)} pts`}
                />
              )}
            />
            <Area
              type="monotone"
              dataKey="remaining"
              name="remaining"
              stroke="#6d5dfc"
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              activeDot={{ r: 5, fill: "#6d5dfc", stroke: "#ffffff", strokeWidth: 2 }}
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="ideal"
              name="ideal"
              stroke="#94a3b8"
              strokeWidth={1.5}
              strokeDasharray="6 5"
              dot={false}
              activeDot={{ r: 4, fill: "#94a3b8", stroke: "#ffffff", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-3 pb-1 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-2"><span className="h-0.5 w-5 rounded bg-violet-500" aria-hidden="true" />Trabajo restante</span>
        <span className="inline-flex items-center gap-2"><span className="w-5 border-t border-dashed border-slate-400" aria-hidden="true" />Línea ideal</span>
      </figcaption>
      <AccessibleTable
        caption="Datos del burndown del sprint activo"
        headers={["Fecha", "Trabajo restante", "Línea ideal"]}
        rows={data.map((item) => [formatDay(item.day, longDateFormatter), formatNumber(item.remaining), formatNumber(item.ideal)])}
      />
    </figure>
  );
}

function VelocityChartPanel({ data }: { data: readonly VelocityDatum[] }) {
  if (data.length === 0) {
    return <EmptyChart title="Aún no hay velocidad histórica" detail="Completa al menos un sprint para comparar puntos comprometidos y terminados." icon={<Activity className="size-5" />} />;
  }

  return (
    <figure className="px-2 pb-3 pt-5 sm:px-4" aria-labelledby="velocity-title">
      <div className="h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%" debounce={80}>
          <BarChart data={data} accessibilityLayer margin={{ top: 6, right: 8, bottom: 4, left: -12 }} barGap={4}>
            <CartesianGrid vertical={false} stroke="#edf0f5" strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              minTickGap={12}
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              tickFormatter={(value: string) => value.length > 11 ? `${value.slice(0, 10)}…` : value}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              width={40}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: "#f5f3ff" }}
              content={<AccessibleTooltip names={{ committed: "Comprometidos", completed: "Completados" }} valueFormatter={(value) => `${tooltipValue(value)} pts`} />}
            />
            <Bar dataKey="committed" name="committed" fill="#c4b5fd" radius={[6, 6, 2, 2]} maxBarSize={30} isAnimationActive={false} />
            <Bar dataKey="completed" name="completed" fill="#6d5dfc" radius={[6, 6, 2, 2]} maxBarSize={30} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-3 pb-1 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-sm bg-violet-300" aria-hidden="true" />Comprometidos</span>
        <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-sm bg-violet-600" aria-hidden="true" />Completados</span>
      </figcaption>
      <AccessibleTable
        caption="Velocidad de los sprints completados"
        headers={["Sprint", "Puntos comprometidos", "Puntos completados"]}
        rows={data.map((item) => [item.name, formatNumber(item.committed), formatNumber(item.completed)])}
      />
    </figure>
  );
}

function StatusDistribution({ data }: { data: readonly StatusBreakdownDatum[] }) {
  const visibleData = data
    .map((item, index) => ({ ...item, value: finite(item.value), color: item.color || fallbackStatusColors[index % fallbackStatusColors.length] }))
    .filter((item) => item.value > 0);
  const total = visibleData.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return <EmptyChart title="Sin tareas para distribuir" detail="Las tareas aparecerán aquí agrupadas por la columna actual del tablero." icon={<Layers3 className="size-5" />} />;
  }

  return (
    <figure className="grid min-h-72 items-center gap-3 px-4 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,0.8fr)]" aria-labelledby="status-title">
      <div className="relative h-52 min-w-0">
        <ResponsiveContainer width="100%" height="100%" debounce={80}>
          <PieChart accessibilityLayer>
            <Pie
              data={visibleData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="86%"
              paddingAngle={2}
              minAngle={4}
              stroke="#ffffff"
              strokeWidth={3}
              isAnimationActive={false}
            >
              {visibleData.map((item) => <Cell key={item.name} fill={item.color} />)}
            </Pie>
            <Tooltip content={<AccessibleTooltip valueFormatter={(value) => `${tooltipValue(value)} tareas`} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center" aria-hidden="true">
          <div>
            <p className="text-2xl font-black tracking-tight text-slate-950">{formatCompactNumber(total)}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">tareas</p>
          </div>
        </div>
      </div>
      <figcaption>
        <ul className="space-y-2.5">
          {visibleData.map((item) => (
            <li key={item.name} className="flex items-center gap-2.5 text-xs">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-medium text-slate-600" title={item.name}>{item.name}</span>
              <span className="font-bold tabular-nums text-slate-900">{item.value}</span>
              <span className="w-8 text-right tabular-nums text-slate-400">{percent(item.value, total)}%</span>
            </li>
          ))}
        </ul>
      </figcaption>
      <AccessibleTable
        caption="Distribución de tareas por estado"
        headers={["Estado", "Tareas", "Porcentaje"]}
        rows={visibleData.map((item) => [item.name, item.value, `${percent(item.value, total)} %`])}
      />
    </figure>
  );
}

function PriorityDistribution({ data }: { data: readonly PriorityBreakdownDatum[] }) {
  const normalized: NormalizedPriorityDatum[] = data
    .map((item) => {
      const key = item.name.toUpperCase();
      return {
        ...item,
        value: finite(item.value),
        label: priorityConfig[key]?.label ?? item.name,
        color: priorityConfig[key]?.color ?? "#64748b",
      };
    })
    .filter((item) => item.value > 0);

  if (normalized.length === 0) {
    return <EmptyChart title="Sin prioridades registradas" detail="Asigna una prioridad para conocer la composición del trabajo pendiente." icon={<Target className="size-5" />} />;
  }

  return (
    <figure className="px-3 pb-4 pt-5 sm:px-5" aria-labelledby="priority-title">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%" debounce={80}>
          <BarChart data={normalized} layout="vertical" accessibilityLayer margin={{ top: 2, right: 20, bottom: 2, left: 0 }}>
            <CartesianGrid horizontal={false} stroke="#edf0f5" strokeDasharray="3 3" />
            <XAxis
              type="number"
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
            />
            <YAxis
              type="category"
              dataKey="label"
              axisLine={false}
              tickLine={false}
              width={68}
              tick={{ fill: "#64748b", fontSize: 11, fontWeight: 600 }}
            />
            <Tooltip cursor={{ fill: "#f8fafc" }} content={<AccessibleTooltip valueFormatter={(value) => `${tooltipValue(value)} tareas`} />} />
            <Bar dataKey="value" name="Tareas" radius={[2, 7, 7, 2]} maxBarSize={24} isAnimationActive={false}>
              {normalized.map((item) => <Cell key={item.name} fill={item.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">Cantidad de tareas agrupada por prioridad.</figcaption>
      <AccessibleTable
        caption="Distribución de tareas por prioridad"
        headers={["Prioridad", "Tareas"]}
        rows={normalized.map((item) => [item.label, item.value])}
      />
    </figure>
  );
}

function CycleTimeCard({ averageDays, p85Days }: { averageDays: number; p85Days: number }) {
  const average = finite(averageDays);
  const p85 = finite(p85Days);
  const hasData = average > 0 || p85 > 0;
  const maxValue = Math.max(average, p85, 1);
  const averageWidth = Math.max(average > 0 ? 4 : 0, (average / maxValue) * 100);
  const p85Width = Math.max(p85 > 0 ? 4 : 0, (p85 / maxValue) * 100);

  return (
    <article className="surface h-full min-w-0 overflow-hidden" aria-labelledby="cycle-time-title">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="cycle-time-title" className="text-sm font-bold text-slate-950">Tiempo de ciclo</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Desde el primer “En curso” hasta completar.</p>
          </div>
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100" aria-hidden="true">
            <Clock3 className="size-[18px]" />
          </span>
        </div>
      </div>

      {hasData ? (
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Promedio</p>
              <p className="mt-1.5 text-2xl font-black tracking-tight text-slate-950">{formatNumber(average)} <span className="text-xs font-bold text-slate-400">días</span></p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Percentil 85</p>
              <p className="mt-1.5 text-2xl font-black tracking-tight text-slate-950">{formatNumber(p85)} <span className="text-xs font-bold text-slate-400">días</span></p>
            </div>
          </div>

          <div className="mt-6 space-y-4" aria-label="Comparación de tiempos de ciclo">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-600">Promedio</span>
                <span className="tabular-nums text-slate-400">{formatNumber(average)} d</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${averageWidth}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-600">P85</span>
                <span className="tabular-nums text-slate-400">{formatNumber(p85)} d</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-violet-500" style={{ width: `${p85Width}%` }} />
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-emerald-50/70 px-3.5 py-3 text-[11px] leading-5 text-emerald-800">
            El 85 % del trabajo completado tardó <strong>{formatNumber(p85)} días o menos</strong> desde que comenzó.
          </div>
        </div>
      ) : (
        <EmptyChart title="Sin muestra de tiempo de ciclo" detail="Completa tareas que hayan pasado por “En curso” para calcular el promedio y el percentil 85." icon={<Clock3 className="size-5" />} />
      )}
    </article>
  );
}

export function ReportsDashboard({ data, className }: ReportsDashboardProps) {
  const gradientId = `burndown-${useId().replace(/:/g, "")}`;
  const statusBreakdown = data.statusBreakdown.map((item) => ({ ...item, value: finite(item.value) }));
  const velocity = data.velocity.map((item) => ({
    ...item,
    committed: finite(item.committed),
    completed: finite(item.completed),
  }));
  const priorityBreakdown = data.priorityBreakdown.map((item) => ({ ...item, value: finite(item.value) }));
  const burndown = data.burndown.map((item) => ({
    ...item,
    ideal: finite(item.ideal),
    remaining: finite(item.remaining),
  }));

  const totalTasks = statusBreakdown.reduce((sum, item) => sum + item.value, 0);
  const totalCompletedPoints = velocity.reduce((sum, item) => sum + item.completed, 0);
  const totalCommittedPoints = velocity.reduce((sum, item) => sum + item.committed, 0);
  const averageVelocity = velocity.length > 0 ? totalCompletedPoints / velocity.length : 0;
  const predictability = totalCommittedPoints > 0 ? percent(totalCompletedPoints, totalCommittedPoints, false) : null;

  const sprintScope = burndown.length > 0
    ? Math.max(burndown[0]?.ideal ?? 0, burndown[0]?.remaining ?? 0)
    : 0;
  const hasActiveSprint = burndown.length > 0;
  const remainingPoints = burndown.at(-1)?.remaining ?? 0;
  const completedSprintPoints = Math.max(0, sprintScope - remainingPoints);
  const sprintProgress = sprintScope > 0 ? percent(completedSprintPoints, sprintScope) : null;

  const hasAnyData = totalTasks > 0
    || velocity.length > 0
    || priorityBreakdown.some((item) => item.value > 0)
    || burndown.length > 0
    || data.cycleTime.averageDays > 0
    || data.cycleTime.p85Days > 0;

  return (
    <div className={cn("space-y-5 sm:space-y-6", className)}>
      {!hasAnyData ? (
        <div className="surface flex items-start gap-3 border-violet-100 bg-violet-50/60 p-4 text-sm text-violet-900" role="status">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-violet-600 shadow-sm" aria-hidden="true">
            <Gauge className="size-[18px]" />
          </span>
          <div>
            <p className="font-bold">El panel está listo para recibir datos</p>
            <p className="mt-1 text-xs leading-5 text-violet-700">Crea tareas e inicia un sprint; los indicadores se completarán sin configuración adicional.</p>
          </div>
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores principales">
        <MetricCard
          label="Trabajo visible"
          value={formatCompactNumber(totalTasks)}
          detail={totalTasks === 1 ? "tarea visible en los tableros" : "tareas visibles en los tableros"}
          icon={<Layers3 className="size-5" />}
          accent="violet"
        />
        <MetricCard
          label="Avance del sprint"
          value={sprintProgress === null ? "—" : `${sprintProgress}%`}
          detail={sprintProgress === null
            ? hasActiveSprint ? "sprint sin puntos estimados" : "sin sprint activo"
            : `${formatNumber(remainingPoints)} de ${formatNumber(sprintScope)} pts restantes`}
          icon={<CheckCircle2 className="size-5" />}
          accent="emerald"
        />
        <MetricCard
          label="Velocidad media"
          value={velocity.length === 0 ? "—" : formatNumber(averageVelocity)}
          detail={velocity.length === 0 ? "sin sprints completados" : `pts por sprint · ${velocity.length} en la muestra`}
          icon={<TrendingUp className="size-5" />}
          accent="blue"
        />
        <MetricCard
          label="Predictibilidad"
          value={predictability === null ? "—" : `${predictability}%`}
          detail={predictability === null ? "requiere puntos comprometidos" : `${formatNumber(totalCompletedPoints)} de ${formatNumber(totalCommittedPoints)} pts`}
          icon={<Target className="size-5" />}
          accent="amber"
        />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-12" aria-label="Flujo del sprint">
        <ChartCard
          id="burndown"
          title="Burndown del sprint"
          description="Trabajo restante frente al descenso ideal del sprint activo."
          badge={burndown.length > 0 ? `${formatNumber(remainingPoints)} pts pendientes` : undefined}
          className="xl:col-span-8"
        >
          <BurndownChartPanel data={burndown} gradientId={gradientId} />
        </ChartCard>
        <div className="xl:col-span-4">
          <CycleTimeCard averageDays={data.cycleTime.averageDays} p85Days={data.cycleTime.p85Days} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2" aria-label="Rendimiento y distribución">
        <ChartCard
          id="velocity"
          title="Velocidad por sprint"
          description="Compara el compromiso inicial con los puntos realmente completados."
          badge={velocity.length > 0 ? `${velocity.length} sprints` : undefined}
        >
          <VelocityChartPanel data={velocity} />
        </ChartCard>
        <ChartCard
          id="status"
          title="Distribución por estado"
          description="Fotografía actual del trabajo a lo largo del flujo."
          badge={totalTasks > 0 ? `${formatCompactNumber(totalTasks)} tareas` : undefined}
        >
          <StatusDistribution data={statusBreakdown} />
        </ChartCard>
      </section>

      <section aria-label="Distribución por prioridad">
        <ChartCard
          id="priority"
          title="Distribución por prioridad"
          description="Permite detectar si el trabajo urgente o de alta prioridad domina la cartera."
          badge="Cartera actual"
        >
          <PriorityDistribution data={priorityBreakdown} />
        </ChartCard>
      </section>
    </div>
  );
}

export default ReportsDashboard;
