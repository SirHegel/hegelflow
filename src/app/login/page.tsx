import type { Metadata } from "next";
import { ArrowRight, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: "Acceso seguro al espacio de trabajo de HegelFlow.",
};

export default async function LoginPage() {
  let hasActiveSession = false;
  try {
    hasActiveSession = Boolean(await getCurrentSession());
  } catch {
    // Si la base de datos no está disponible, el formulario conserva una
    // respuesta recuperable y la API comunica el problema sin filtrar datos.
  }

  if (hasActiveSession) redirect("/");

  return (
    <main className="relative min-h-svh overflow-hidden bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(124,58,237,0.13),transparent_34%),radial-gradient(circle_at_80%_78%,rgba(14,165,164,0.12),transparent_32%)]"
      />
      <div className="relative mx-auto grid min-h-svh max-w-7xl lg:grid-cols-[1.08fr_0.92fr]">
        <section className="hidden border-r border-slate-200/80 px-12 py-14 lg:flex lg:flex-col lg:justify-between dark:border-white/10">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-violet-600 text-sm font-black tracking-tight text-white shadow-lg shadow-violet-600/25">
              HF
            </span>
            <div>
              <p className="text-lg font-black tracking-tight">HegelFlow</p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Trabajo claro. Equipos alineados.
              </p>
            </div>
          </div>

          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200">
              <Sparkles aria-hidden="true" className="size-3.5" />
              Centro de operaciones
            </span>
            <h1 className="mt-6 text-5xl font-black leading-[1.05] tracking-[-0.045em] text-balance">
              Del plan a la entrega, sin perder el contexto.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-slate-600 dark:text-slate-300">
              Scrum y Kanban en un solo lugar para priorizar, delegar y hacer visible el avance del equipo.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 backdrop-blur dark:border-white/10 dark:bg-white/5">
                <Workflow aria-hidden="true" className="size-6 text-violet-600 dark:text-violet-300" />
                <p className="mt-4 font-bold">Un flujo compartido</p>
                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Objetivos, sprints, carga y tareas siempre conectados.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 backdrop-blur dark:border-white/10 dark:bg-white/5">
                <ShieldCheck aria-hidden="true" className="size-6 text-teal-600 dark:text-teal-300" />
                <p className="mt-4 font-bold">Acceso protegido</p>
                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Sesiones revocables y permisos definidos por perfil.
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 dark:text-slate-500">
            Uso exclusivo del equipo autorizado.
          </p>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-10 lg:px-14">
          <div className="w-full max-w-md">
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <span className="grid size-10 place-items-center rounded-xl bg-violet-600 text-xs font-black text-white">
                HF
              </span>
              <span className="font-black tracking-tight">HegelFlow</span>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-900/5 sm:p-9 dark:border-white/10 dark:bg-slate-900/80 dark:shadow-black/20">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-400/10 dark:text-violet-200">
                <ArrowRight aria-hidden="true" className="size-6" />
              </div>
              <h2 className="mt-6 text-3xl font-black tracking-[-0.035em]">
                Bienvenido de nuevo
              </h2>
              <p className="mt-2 leading-7 text-slate-500 dark:text-slate-400">
                Ingresa tus credenciales para continuar al espacio de trabajo.
              </p>

              <LoginForm />
            </div>

            <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
              ¿Necesitas acceso? Solicítalo al administrador del espacio.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
