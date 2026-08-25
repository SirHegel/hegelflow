"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Crown,
  KeyRound,
  LoaderCircle,
  MailPlus,
  Plus,
  ShieldCheck,
  UserRoundCog,
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

export function TeamView({ members, context }: { members: TeamMember[]; context: WorkspaceContext }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManage = context.accessLevel === "OWNER" || context.accessLevel === "ADMIN";

  async function createProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" },
        body: JSON.stringify({
          fullName: form.get("fullName"),
          email: form.get("email") || null,
          workRole: form.get("workRole"),
          accessLevel: form.get("accessLevel"),
          capacityPoints: Number(form.get("capacityPoints")),
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

  return (
    <div className="mx-auto max-w-[1380px] space-y-7 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <SectionHeading eyebrow="Personas y acceso" title="Equipo" description="Separa el cargo de trabajo de los permisos técnicos y distribuye la capacidad con claridad." actions={canManage ? <Button onClick={() => setShowCreate(true)}><Plus className="size-4" /> Crear perfil</Button> : undefined} />
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
                  <div className="mt-2 flex flex-wrap gap-1.5"><Badge color={member.accessLevel === "OWNER" ? "#6d5dfc" : undefined}>{member.accessLevel}</Badge><Badge color={member.hasAccount ? "#0f9f7a" : "#f59e0b"}>{member.hasAccount ? "Acceso activo" : "Perfil operativo"}</Badge></div>
                </div>
                {canManage && member.accessLevel !== "OWNER" ? <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={`Editar ${member.fullName}`}><UserRoundCog className="size-4" /></button> : null}
              </div>
              <div className="mt-6"><div className="flex items-center justify-between text-[11px]"><span className="font-semibold text-slate-500">Capacidad utilizada</span><span className={over ? "font-bold text-rose-600" : "font-bold text-slate-700"}>{utilization}%</span></div><Progress value={percent(member.activePoints, member.capacityPoints)} className="mt-2" barClassName={over ? "bg-rose-500" : utilization > 75 ? "bg-amber-500" : "bg-violet-500"} /><div className="mt-2 flex justify-between text-[10px] text-slate-400"><span>{member.activePoints}/{member.capacityPoints} puntos</span><span>{member.openTasks} tareas abiertas</span></div></div>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4"><div><p className="text-xl font-bold text-slate-900">{member.openTasks}</p><p className="text-[10px] text-slate-400">En curso</p></div><div><p className="text-xl font-bold text-slate-900">{member.completedTasks}</p><p className="text-[10px] text-slate-400">Completadas</p></div></div>
            </article>
          );
        })}
      </section>

      <section className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6"><div><h2 className="text-sm font-bold text-slate-900">Matriz de acceso</h2><p className="mt-0.5 text-xs text-slate-400">Permisos técnicos, independientes del cargo</p></div><ShieldCheck className="size-5 text-violet-600" /></div>
        <div className="app-scrollbar overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs"><thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400"><tr><th className="px-6 py-3.5">Nivel</th><th className="px-4 py-3.5">Tableros y tareas</th><th className="px-4 py-3.5">Sprints</th><th className="px-4 py-3.5">Equipo</th><th className="px-4 py-3.5">Auditoría</th><th className="px-4 py-3.5">Configuración</th></tr></thead><tbody className="divide-y divide-slate-100">{[
            ["OWNER", true, true, true, true, true], ["ADMIN", true, true, true, false, true], ["MEMBER", true, false, false, false, false], ["VIEWER", false, false, false, false, false],
          ].map(([role, ...permissions]) => <tr key={String(role)}><td className="px-6 py-4"><p className="font-bold text-slate-800">{String(role)}</p><p className="mt-0.5 text-[10px] text-slate-400">{roleDescription[String(role)]}</p></td>{permissions.map((allowed, index) => <td key={index} className="px-4 py-4">{allowed ? <span className="grid size-6 place-items-center rounded-full bg-emerald-50 text-emerald-600"><Check className="size-3.5" /></span> : <span className="text-slate-300">—</span>}</td>)}</tr>)}</tbody></table>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="surface flex items-start gap-4 p-5"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600"><KeyRound className="size-5" /></span><div><h3 className="text-sm font-bold text-slate-800">Accesos por invitación</h3><p className="mt-1 text-xs leading-5 text-slate-500">Los perfiles operativos pueden existir sin credenciales. Cuando se habilite su cuenta recibirán una invitación de un solo uso.</p></div></div>
        <div className="surface flex items-start gap-4 p-5"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700"><Users className="size-5" /></span><div><h3 className="text-sm font-bold text-slate-800">Capacidad configurable</h3><p className="mt-1 text-xs leading-5 text-slate-500">Los puntos de capacidad sirven para detectar sobrecarga, no para evaluar el rendimiento individual.</p></div></div>
      </section>

      {showCreate ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <button className="absolute inset-0" onClick={() => setShowCreate(false)} aria-label="Cerrar" />
          <form onSubmit={createProfile} className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-violet-600">Delegación</p><h2 className="mt-1 text-xl font-bold text-slate-950">Crear perfil de trabajo</h2></div><button type="button" onClick={() => setShowCreate(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="size-4" /></button></div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <FormField label="Nombre completo"><input name="fullName" required minLength={2} maxLength={120} className="form-input" placeholder="Nombre y apellido" /></FormField>
              <FormField label="Cargo"><input name="workRole" required maxLength={120} className="form-input" placeholder="Ej. Product Owner" /></FormField>
              <FormField label="Correo (opcional)"><input name="email" type="email" maxLength={255} className="form-input" placeholder="nombre@ejemplo.com" /></FormField>
              <FormField label="Nivel de acceso"><select name="accessLevel" defaultValue="MEMBER" className="form-input"><option value="ADMIN">Administrador</option><option value="MEMBER">Miembro</option><option value="VIEWER">Observador</option></select></FormField>
              <FormField label="Capacidad por sprint"><input name="capacityPoints" type="number" min="0" max="500" defaultValue="20" className="form-input" /></FormField>
            </div>
            <div className="mt-5 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800"><MailPlus className="mr-1 inline size-4" /> El perfil se crea sin contraseña. El acceso se habilita después mediante invitación segura.</div>
            <div className="mt-6 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />} Crear perfil</Button></div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-bold text-slate-600">{label}{children}</label>; }
