"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Crown,
  KeyRound,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SectionHeading } from "@/components/ui/section-heading";
import { percent } from "@/lib/utils";
import type { WorkspaceContext } from "@/lib/types";

type TeamMember = {
  id: string;
  fullName: string;
  workRole: string;
  accessLevel: string;
  status: string;
  avatarColor: string;
  capacityPoints: number;
  hasAccount: boolean;
  username: string | null;
  openTasks: number;
  activePoints: number;
  completedTasks: number;
};

const roleDescription: Record<string, string> = {
  OWNER: "Control total y gobierno",
  ADMIN: "Gestiona equipo y proyectos",
  MEMBER: "Ejecuta y colabora",
  VIEWER: "Consulta sin modificar",
};

const accessAreas = ["Tableros y tareas", "Sprints", "Equipo", "Auditoría", "Configuración"] as const;
const accessMatrix = [
  { role: "OWNER", access: ["Gestiona", "Gestiona", "Gestiona", "Consulta", "Gestiona"] },
  { role: "ADMIN", access: ["Gestiona", "Gestiona", "Gestiona", "Sin acceso", "Gestiona"] },
  { role: "MEMBER", access: ["Colabora", "Consulta", "Consulta", "Sin acceso", "Personal"] },
  { role: "VIEWER", access: ["Consulta", "Consulta", "Consulta", "Sin acceso", "Sin acceso"] },
] as const;

const accessModeStyles = {
  Gestiona: "bg-emerald-50 text-emerald-700",
  Colabora: "bg-blue-50 text-blue-700",
  Consulta: "bg-slate-100 text-slate-600",
  Personal: "bg-violet-50 text-violet-700",
  "Sin acceso": "bg-slate-50 text-slate-400",
} as const;

export function TeamView({ members, context }: { members: TeamMember[]; context: WorkspaceContext }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [createAccount, setCreateAccount] = useState(context.accessLevel === "OWNER");
  const [accountTarget, setAccountTarget] = useState<{ id: string; fullName: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManage = context.accessLevel === "OWNER" || context.accessLevel === "ADMIN";
  const isOwner = context.accessLevel === "OWNER";

  function openCreate() {
    setError(null);
    setCreateAccount(isOwner);
    setShowCreate(true);
  }

  async function createProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const password = String(form.get("password") ?? "");
      const passwordConfirmation = String(form.get("passwordConfirmation") ?? "");
      if (isOwner && createAccount && password !== passwordConfirmation) {
        throw new Error("Las contraseñas no coinciden.");
      }

      const response = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" },
        body: JSON.stringify({
          fullName: form.get("fullName"),
          email: form.get("email") || null,
          workRole: form.get("workRole"),
          accessLevel: form.get("accessLevel"),
          capacityPoints: Number(form.get("capacityPoints")),
          account: isOwner && createAccount
            ? {
                username: form.get("username"),
                password,
              }
            : null,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "No fue posible crear el perfil.");
      setShowCreate(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible crear el perfil.");
    } finally {
      setSaving(false);
    }
  }

  async function enableAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accountTarget) return;

    setSaving(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const passwordConfirmation = String(form.get("passwordConfirmation") ?? "");

    try {
      if (password !== passwordConfirmation) throw new Error("Las contraseñas no coinciden.");
      const response = await fetch(`/api/team/${accountTarget.id}/account`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" },
        body: JSON.stringify({ username: form.get("username"), password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "No fue posible habilitar la cuenta.");
      setAccountTarget(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible habilitar la cuenta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1380px] space-y-7 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <SectionHeading eyebrow="Personas y acceso" title="Equipo" description="Separa el cargo de trabajo de los permisos técnicos y distribuye la capacidad con claridad." actions={canManage ? <Button onClick={openCreate}><Plus className="size-4" /> {isOwner ? "Crear usuario / perfil" : "Crear perfil"}</Button> : undefined} />
      {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {members.map((member) => {
          const utilization = member.capacityPoints ? Math.round((member.activePoints / member.capacityPoints) * 100) : 0;
          const over = utilization > 100;
          return (
            <article key={member.id} className="surface p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <Avatar name={member.fullName} color={member.avatarColor} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><h2 className="truncate text-sm font-bold text-slate-900">{member.fullName}</h2>{member.accessLevel === "OWNER" ? <Crown className="size-4 shrink-0 text-amber-500" /> : null}</div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{member.workRole}</p>
                  {isOwner && member.username ? <p className="mt-1 truncate text-[11px] font-semibold text-slate-400">@{member.username}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-1.5"><Badge color={member.accessLevel === "OWNER" ? "#6d5dfc" : undefined}>{member.accessLevel}</Badge><Badge color={member.hasAccount ? "#0f9f7a" : "#f59e0b"}>{member.hasAccount ? "Acceso activo" : "Solo perfil"}</Badge></div>
                </div>
                {isOwner && !member.hasAccount && member.accessLevel !== "OWNER" ? (
                  <button
                    className="rounded-lg border border-violet-100 bg-violet-50 px-2.5 py-2 text-[11px] font-bold text-violet-700 transition hover:bg-violet-100"
                    onClick={() => { setError(null); setAccountTarget({ id: member.id, fullName: member.fullName }); }}
                  >
                    Habilitar acceso
                  </button>
                ) : null}
              </div>
              <div className="mt-6"><div className="flex items-center justify-between text-[11px]"><span className="font-semibold text-slate-500">Capacidad utilizada</span><span className={over ? "font-bold text-rose-600" : "font-bold text-slate-700"}>{utilization}%</span></div><Progress value={percent(member.activePoints, member.capacityPoints)} className="mt-2" barClassName={over ? "bg-rose-500" : utilization > 75 ? "bg-amber-500" : "bg-violet-500"} /><div className="mt-2 flex justify-between gap-3 text-[11px] text-slate-400"><span>{member.activePoints}/{member.capacityPoints} puntos</span><span className="text-right">{member.openTasks} tareas abiertas</span></div></div>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4"><div><p className="text-xl font-bold text-slate-900">{member.openTasks}</p><p className="text-[11px] text-slate-400">En curso</p></div><div><p className="text-xl font-bold text-slate-900">{member.completedTasks}</p><p className="text-[11px] text-slate-400">Completadas</p></div></div>
            </article>
          );
        })}
      </section>

      <section className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6"><div><h2 className="text-sm font-bold text-slate-900">Matriz de acceso</h2><p className="mt-0.5 text-xs text-slate-400">Capacidades de gestión y consulta por nivel</p></div><ShieldCheck className="size-5 text-violet-600" /></div>
        <div className="divide-y divide-slate-100 md:hidden">
          {accessMatrix.map(({ role, access }) => (
            <article key={role} className="px-5 py-4">
              <h3 className="text-xs font-bold text-slate-800">{role}</h3>
              <p className="mt-0.5 text-[11px] text-slate-500">{roleDescription[role]}</p>
              <dl className="mt-3 grid gap-2">
                {accessAreas.map((area, index) => (
                  <div key={area} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                    <dt className="min-w-0 break-words text-[11px] font-medium text-slate-600">{area}</dt>
                    <dd className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold ${accessModeStyles[access[index]]}`}><span className="size-1.5 rounded-full bg-current" aria-hidden="true" />{access[index]}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
        <div className="app-scrollbar hidden overflow-x-auto md:block">
          <table className="w-full min-w-[700px] text-left text-xs"><thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-400"><tr><th className="px-6 py-3.5">Nivel</th>{accessAreas.map((area) => <th key={area} className="px-4 py-3.5">{area}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{accessMatrix.map(({ role, access }) => <tr key={role}><td className="px-6 py-4"><p className="font-bold text-slate-800">{role}</p><p className="mt-0.5 text-[11px] text-slate-400">{roleDescription[role]}</p></td>{access.map((mode, index) => <td key={accessAreas[index]} className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-bold ${accessModeStyles[mode]}`}><span className="size-1.5 rounded-full bg-current" aria-hidden="true" />{mode}</span></td>)}</tr>)}</tbody></table>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="surface flex items-start gap-4 p-5"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600"><KeyRound className="size-5" /></span><div><h3 className="text-sm font-bold text-slate-800">Cuentas separadas por persona</h3><p className="mt-1 text-xs leading-5 text-slate-500">El propietario puede habilitar un usuario y una contraseña inicial. Cada persona puede cambiarla después desde Configuración.</p></div></div>
        <div className="surface flex items-start gap-4 p-5"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700"><Users className="size-5" /></span><div><h3 className="text-sm font-bold text-slate-800">Capacidad configurable</h3><p className="mt-1 text-xs leading-5 text-slate-500">Los puntos de capacidad sirven para detectar sobrecarga, no para evaluar el rendimiento individual.</p></div></div>
      </section>

      {showCreate ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto overscroll-contain bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="create-profile-title" onKeyDown={(event) => { if (event.key === "Escape") setShowCreate(false); }}>
          <button className="absolute inset-0" onClick={() => setShowCreate(false)} aria-label="Cerrar" />
          <form onSubmit={createProfile} className="relative my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-violet-600">Delegación</p><h2 id="create-profile-title" className="mt-1 text-xl font-bold text-slate-950">{isOwner ? "Crear usuario o perfil" : "Crear perfil de trabajo"}</h2></div><button type="button" onClick={() => setShowCreate(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Cerrar formulario de perfil"><X className="size-4" /></button></div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <FormField label="Nombre completo"><input name="fullName" autoFocus required minLength={2} maxLength={120} className="form-input" placeholder="Nombre y apellido" /></FormField>
              <FormField label="Cargo"><input name="workRole" required maxLength={120} className="form-input" placeholder="Ej. Product Owner" /></FormField>
              <FormField label="Correo (opcional)"><input name="email" type="email" maxLength={255} className="form-input" placeholder="nombre@ejemplo.com" /></FormField>
              <FormField label="Nivel de acceso"><select name="accessLevel" defaultValue="MEMBER" className="form-input"><option value="ADMIN">Administrador</option><option value="MEMBER">Miembro</option><option value="VIEWER">Observador</option></select></FormField>
              <FormField label="Capacidad por sprint"><input name="capacityPoints" type="number" min="0" max="500" defaultValue="20" className="form-input" /></FormField>
            </div>
            {isOwner ? (
              <div className="mt-5 rounded-xl border border-violet-100 bg-violet-50/70 p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={createAccount} onChange={(event) => setCreateAccount(event.target.checked)} className="mt-0.5 size-4 accent-violet-600" />
                  <span><span className="block text-xs font-bold text-violet-900">Crear también su cuenta de acceso</span><span className="mt-0.5 block text-[11px] leading-4 text-violet-700">Podrá iniciar sesión inmediatamente con estas credenciales.</span></span>
                </label>
                {createAccount ? (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <FormField label="Usuario"><input name="username" required minLength={3} maxLength={64} pattern="[a-z0-9._-]{3,64}" autoCapitalize="none" autoComplete="off" spellCheck={false} className="form-input" placeholder="nombre.apellido" /></FormField>
                    <span className="hidden sm:block" aria-hidden="true" />
                    <FormField label="Contraseña inicial"><input name="password" type="password" required minLength={14} maxLength={256} autoComplete="new-password" className="form-input" /></FormField>
                    <FormField label="Confirmar contraseña"><input name="passwordConfirmation" type="password" required minLength={14} maxLength={256} autoComplete="new-password" className="form-input" /></FormField>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-5 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">El propietario puede añadir credenciales a este perfil posteriormente.</div>
            )}
            {error ? <p role="alert" className="mt-4 text-xs font-semibold text-rose-600">{error}</p> : null}
            <div className="mt-6 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />} {createAccount && isOwner ? "Crear usuario" : "Crear perfil"}</Button></div>
          </form>
        </div>
      ) : null}

      {accountTarget ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto overscroll-contain bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="enable-account-title" onKeyDown={(event) => { if (event.key === "Escape") setAccountTarget(null); }}>
          <button className="absolute inset-0" onClick={() => setAccountTarget(null)} aria-label="Cerrar" />
          <form onSubmit={enableAccount} className="relative my-auto w-full max-w-lg rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-violet-600">Cuenta de acceso</p><h2 id="enable-account-title" className="mt-1 text-xl font-bold text-slate-950">Habilitar a {accountTarget.fullName}</h2></div><button type="button" onClick={() => setAccountTarget(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Cerrar formulario de cuenta"><X className="size-4" /></button></div>
            <p className="mt-3 text-xs leading-5 text-slate-500">La cuenta quedará vinculada a este perfil. Comparte la contraseña inicial mediante un canal seguro.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <FormField label="Usuario"><input name="username" autoFocus required minLength={3} maxLength={64} pattern="[a-z0-9._-]{3,64}" autoCapitalize="none" autoComplete="off" spellCheck={false} className="form-input" placeholder="nombre.apellido" /></FormField>
              <span className="hidden sm:block" aria-hidden="true" />
              <FormField label="Contraseña inicial"><input name="password" type="password" required minLength={14} maxLength={256} autoComplete="new-password" className="form-input" /></FormField>
              <FormField label="Confirmar contraseña"><input name="passwordConfirmation" type="password" required minLength={14} maxLength={256} autoComplete="new-password" className="form-input" /></FormField>
            </div>
            {error ? <p role="alert" className="mt-4 text-xs font-semibold text-rose-600">{error}</p> : null}
            <div className="mt-6 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setAccountTarget(null)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Habilitar cuenta</Button></div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-bold text-slate-600">{label}{children}</label>; }
