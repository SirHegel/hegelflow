"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  Bell,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronsUpDown,
  CircleHelp,
  Columns3,
  FolderKanban,
  Gauge,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { WorkspaceContext } from "@/lib/types";

type BoardLink = { id: string; name: string; color: string };

const nav = [
  { href: "/", label: "Resumen", icon: Gauge, exact: true },
  { href: "/backlog", label: "Backlog", icon: FolderKanban },
  { href: "/sprints", label: "Sprints", icon: Columns3 },
  { href: "/calendar", label: "Calendario", icon: CalendarDays },
  { href: "/reports", label: "Reportes", icon: ChartNoAxesCombined },
  { href: "/team", label: "Equipo", icon: Users },
  { href: "/activity", label: "Actividad", icon: Activity },
];

export function AppShell({ context, boards, children }: {
  context: WorkspaceContext;
  boards: BoardLink[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Protection": "1",
        },
        body: "{}",
      });
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-[#172036] text-slate-300">
      <div className="flex h-18 items-center gap-3 border-b border-white/8 px-5">
        <div className="grid size-9 place-items-center rounded-xl bg-violet-500 font-black tracking-tight text-white shadow-lg shadow-violet-950/25">
          HF
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">HegelFlow</p>
          <p className="truncate text-[11px] text-slate-400">Proyecto personal</p>
        </div>
        <button className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-white" aria-label="Cambiar espacio">
          <ChevronsUpDown className="size-4" />
        </button>
      </div>

      <div className="app-scrollbar flex-1 overflow-y-auto px-3 py-5">
        <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Espacio de trabajo</p>
        <nav aria-label="Navegación principal" className="space-y-1">
          {nav.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition",
                  active ? "bg-violet-500/16 text-violet-200" : "text-slate-400 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className={cn("size-[18px]", active && "text-violet-400")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-7 flex items-center justify-between px-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Tableros</p>
          <button className="rounded-md p-1 text-slate-500 transition hover:bg-white/5 hover:text-white" aria-label="Crear tablero">
            <Plus className="size-4" />
          </button>
        </div>
        <nav aria-label="Tableros" className="mt-2 space-y-1">
          {boards.map((board) => {
            const href = `/boards/${board.id}`;
            const active = pathname === href;
            return (
              <Link
                key={board.id}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex h-9 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition",
                  active ? "bg-white/7 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white",
                )}
              >
                <span className="size-2.5 rounded-sm" style={{ backgroundColor: board.color }} />
                <span className="truncate">{board.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-7 rounded-2xl border border-violet-400/15 bg-gradient-to-br from-violet-500/12 to-cyan-400/5 p-4">
          <Sparkles className="size-5 text-violet-400" />
          <p className="mt-3 text-xs font-semibold text-white">Metodología híbrida</p>
          <p className="mt-1 text-[11px] leading-4 text-slate-400">Scrum para planear. Kanban para fluir y mejorar.</p>
        </div>
      </div>

      <div className="border-t border-white/8 p-3">
        <Link
          href="/settings"
          onClick={() => setMobileOpen(false)}
          className={cn(
            "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition",
            pathname.startsWith("/settings") ? "bg-white/7 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white",
          )}
        >
          <Settings2 className="size-[18px]" />
          Configuración
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f7f7fb]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú" />
          <aside className="relative h-full w-[min(82vw,280px)] shadow-2xl">{sidebar}</aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-18 items-center gap-3 border-b border-slate-200 bg-white px-4 shadow-[0_1px_0_rgba(15,23,42,0.02)] sm:px-6 lg:px-8">
          <button
            className="rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="size-5" />
          </button>

          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-10 min-w-0 max-w-lg flex-1 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-left text-sm text-slate-400 transition hover:border-slate-300 hover:bg-white sm:px-4"
          >
            <Search className="size-4 shrink-0" />
            <span className="truncate">Buscar tareas, personas y tableros…</span>
            <kbd className="ml-auto hidden rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-semibold text-slate-400 sm:block">⌘ K</kbd>
          </button>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <button className="hidden rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 sm:block" aria-label="Ayuda">
              <CircleHelp className="size-5" />
            </button>
            <button className="relative rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800" aria-label="Notificaciones">
              <Bell className="size-5" />
            </button>
            <div className="mx-1 hidden h-7 w-px bg-slate-200 sm:block" />
            <div className="group relative">
              <button className="flex items-center gap-2 rounded-xl p-1.5 transition hover:bg-slate-100" aria-label="Menú de usuario">
                <Avatar name={context.fullName} color={context.avatarColor} size="sm" />
                <span className="hidden text-left md:block">
                  <span className="block max-w-32 truncate text-xs font-bold text-slate-800">{context.fullName}</span>
                  <span className="block text-[11px] text-slate-500">{context.workRole}</span>
                </span>
                <ChevronDown className="hidden size-4 text-slate-400 md:block" />
              </button>
              <div className="invisible absolute right-0 top-full z-40 w-56 translate-y-1 pt-2 opacity-0 transition group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                <div className="rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10">
                  <div className="border-b border-slate-100 px-3 py-2.5">
                    <p className="truncate text-xs font-bold text-slate-900">@{context.username}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{context.accessLevel}</p>
                  </div>
                  <Link href="/settings" className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
                    <Settings2 className="size-4" /> Preferencias
                  </Link>
                  <button
                    onClick={logout}
                    disabled={loggingOut}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  >
                    <LogOut className="size-4" /> {loggingOut ? "Cerrando…" : "Cerrar sesión"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4.5rem)]">{children}</main>
      </div>

      {searchOpen ? <CommandSearch onClose={() => setSearchOpen(false)} /> : null}
    </div>
  );
}

function CommandSearch({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Array<{ id: string; boardId: string; key: string; title: string; description: string; priority: string; columnName: string }>>([]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(normalized)}`, { signal: controller.signal });
        const payload = await response.json();
        setResults(Array.isArray(payload.results) ? payload.results : []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setResults([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  function openResult(result: { id: string; boardId: string }) {
    onClose();
    router.push(`/boards/${result.boardId}?task=${result.id}`);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-950/45 px-4 pt-[12vh] backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Buscar" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
      <button className="absolute inset-0" onClick={onClose} aria-label="Cerrar búsqueda" />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/50 bg-white shadow-2xl shadow-slate-950/25">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          <Search className="size-5 text-violet-500" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              if (value.trim().length < 2) {
                setResults([]);
                setLoading(false);
              }
            }}
            placeholder="Escribe para buscar…"
            className="h-14 min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            onKeyDown={(event) => {
              if (event.key === "Enter" && results[0]) openResult(results[0]);
            }}
          />
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Cerrar búsqueda">
            <X className="size-4" />
          </button>
        </div>
        <div className="app-scrollbar max-h-[55vh] overflow-y-auto p-2">
          {loading ? <div className="p-6 text-center text-xs text-slate-400">Buscando…</div> : results.length ? (
            <div className="space-y-1">
              {results.map((result) => (
                <button key={result.id} onClick={() => openResult(result)} className="flex w-full items-start gap-3 rounded-xl p-3 text-left transition hover:bg-violet-50">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-600"><Columns3 className="size-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-slate-800">{result.title}</span><span className="mt-1 block truncate text-[11px] text-slate-400">{result.key} · {result.columnName} · {result.priority}</span></span>
                </button>
              ))}
            </div>
          ) : query.trim().length >= 2 ? (
            <div className="p-6 text-center"><p className="text-sm font-medium text-slate-600">Sin resultados</p><p className="mt-1 text-xs text-slate-400">Prueba con otra palabra, clave o descripción.</p></div>
          ) : (
            <div className="p-5 text-center">
              <>
                <p className="text-sm font-medium text-slate-700">Búsqueda global</p>
                <p className="mt-1 text-xs text-slate-400">Encuentra tareas por título, descripción, etiqueta o clave.</p>
              </>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
