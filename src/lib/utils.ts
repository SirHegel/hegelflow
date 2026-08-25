import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function formatDate(value: string | null, options?: Intl.DateTimeFormatOptions) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    ...options,
  }).format(new Date(value));
}

export function formatRelativeDate(value: string) {
  const date = new Date(value);
  const now = new Date();
  const diffDays = Math.round((date.getTime() - now.getTime()) / 86_400_000);
  const formatter = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  if (Math.abs(diffDays) < 14) return formatter.format(diffDays, "day");
  return formatDate(value, { day: "numeric", month: "short", year: "numeric" });
}

export function dateKeyInTimeZone(date = new Date(), timeZone = "America/Bogota") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: "year" | "month" | "day") => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}
