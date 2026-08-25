"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Check,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Plus,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  ToggleLeft,
  ToggleRight,
  Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import type { WorkspaceContext } from "@/lib/types";

type SettingsData = {
  rules: Array<{ id: string; name: string; triggerType: string; actionType: string; isEnabled: boolean; runCount: number; lastRunAt: string | null }>;
  customFields: Array<{ id: string; name: string; fieldType: string; isRequired: boolean }>;
  savedViews: Array<{ id: string; name: string; viewType: string; isShared: boolean }>;
};

export function SettingsView({ data, context, sessionExpiresAt }: { data: SettingsData; context: WorkspaceContext; sessionExpiresAt: string }) {
  const router = useRouter();
  const [pendingRule, setPendingRule] = useState<string | null>(null);
  const [passwordPending, setPasswordPending] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const canManage = context.accessLevel === "OWNER" || context.accessLevel === "ADMIN";

  async function toggleRule(id: string, enabled: boolean) {
    setPendingRule(id);
    setMessage(null);
    try {
      const response = await fetch(`/api/automations/${id}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" },
        body: JSON.stringify({ enabled }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "No fue posible actualizar la regla.");
      router.refresh();
      setMessage({ type: "success", text: "Automatización actualizada." });
    } catch (caught) {
      setMessage({ type: "error", text: caught instanceof Error ? caught.message : "No fue posible actualizar la regla." });
    } finally {
      setPendingRule(null);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordPending(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (newPassword !== confirmation) {
      setMessage({ type: "error", text: "La confirmación no coincide con la nueva contraseña." });
      setPasswordPending(false);
      return;
    }
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" },
        body: JSON.stringify({ currentPassword: form.get("currentPassword"), newPassword }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? result.message ?? "No fue posible cambiar la contraseña.");
      event.currentTarget.reset();
      setMessage({ type: "success", text: "Contraseña actualizada. Las demás sesiones fueron revocadas." });
    } catch (caught) {
      setMessage({ type: "error", text: caught instanceof Error ? caught.message : "No fue posible cambiar la contraseña." });
    } finally {
      setPasswordPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-7 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <SectionHeading eyebrow="Administración" title="Configuración" description="Gobierna el espacio, automatiza tareas repetitivas y protege el acceso del equipo." />
      {message ? <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{message.text}</div> : null}

      <section className="surface overflow-hidden">
        <SettingsHeader icon={SlidersHorizontal} title="Espacio de trabajo" description="Identidad y comportamiento general" />
        <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
          <label className="block text-xs font-bold text-slate-600">Nombre<input defaultValue={context.workspaceName} disabled={!canManage} className="form-input" /></label>
          <label className="block text-xs font-bold text-slate-600">Identificador<input defaultValue={context.workspaceSlug} disabled className="form-input bg-slate-50" /></label>
          <label className="block text-xs font-bold text-slate-600">Zona horaria<select defaultValue="America/Bogota" disabled={!canManage} className="form-input"><option value="America/Bogota">América/Bogotá (UTC-5)</option></select></label>
          <label className="block text-xs font-bold text-slate-600">Inicio de semana<select defaultValue="1" disabled={!canManage} className="form-input"><option value="1">Lunes</option><option value="0">Domingo</option></select></label>
        </div>
        {canManage ? <div className="flex justify-end border-t border-slate-100 px-5 py-4 sm:px-6"><Button size="sm"><Save className="size-4" /> Guardar cambios</Button></div> : null}
      </section>

      <section className="surface overflow-hidden">
        <SettingsHeader icon={Bot} title="Automatizaciones" description="Reglas trigger → acción sin cuotas por plan" action={canManage ? <Button size="sm" variant="secondary"><Plus className="size-4" /> Nueva regla</Button> : undefined} />
        <div className="divide-y divide-slate-100">
          {data.rules.map((rule) => <div key={rule.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600"><Workflow className="size-4" /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-bold text-slate-800">{rule.name}</p><Badge color={rule.isEnabled ? "#0f9f7a" : undefined}>{rule.isEnabled ? "Activa" : "Pausada"}</Badge></div><p className="mt-1 text-[10px] text-slate-400">{humanize(rule.triggerType)} → {humanize(rule.actionType)} · {rule.runCount} ejecuciones</p></div>{canManage ? <button onClick={() => toggleRule(rule.id, !rule.isEnabled)} disabled={pendingRule === rule.id} className="inline-flex items-center gap-2 self-start rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-50 sm:self-auto">{pendingRule === rule.id ? <LoaderCircle className="size-5 animate-spin" /> : rule.isEnabled ? <ToggleRight className="size-7 text-violet-600" /> : <ToggleLeft className="size-7" />}{rule.isEnabled ? "Activa" : "Pausada"}</button> : null}</div>)}
          {!data.rules.length ? <p className="px-6 py-10 text-center text-xs text-slate-400">Aún no hay automatizaciones configuradas.</p> : null}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface overflow-hidden"><SettingsHeader icon={SlidersHorizontal} title="Campos personalizados" description="Información estructurada por tarea" action={canManage ? <button className="rounded-lg p-2 text-violet-600 hover:bg-violet-50"><Plus className="size-4" /></button> : undefined} /><div className="divide-y divide-slate-100 px-5 sm:px-6">{data.customFields.map((field) => <div key={field.id} className="flex items-center justify-between py-3.5"><div><p className="text-xs font-bold text-slate-800">{field.name}</p><p className="mt-0.5 text-[10px] text-slate-400">{field.fieldType}</p></div>{field.isRequired ? <Badge color="#ef4444">Obligatorio</Badge> : <Badge>Opcional</Badge>}</div>)}{!data.customFields.length ? <p className="py-8 text-center text-xs text-slate-400">Sin campos personalizados.</p> : null}</div></section>
        <section className="surface overflow-hidden"><SettingsHeader icon={Eye} title="Vistas guardadas" description="Filtros personales y compartidos" action={<Badge>{data.savedViews.length}</Badge>} /><div className="divide-y divide-slate-100 px-5 sm:px-6">{data.savedViews.map((view) => <div key={view.id} className="flex items-center justify-between py-3.5"><div><p className="text-xs font-bold text-slate-800">{view.name}</p><p className="mt-0.5 text-[10px] text-slate-400">{view.viewType}</p></div><Badge>{view.isShared ? "Compartida" : "Privada"}</Badge></div>)}{!data.savedViews.length ? <p className="py-8 text-center text-xs text-slate-400">Guarda filtros desde cualquier vista.</p> : null}</div></section>
      </div>

      <section className="surface overflow-hidden">
        <SettingsHeader icon={ShieldCheck} title="Seguridad de la cuenta" description={`Sesión activa hasta ${new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(sessionExpiresAt))}`} />
        <form onSubmit={changePassword} className="p-5 sm:p-6">
          <div className="flex items-start gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><LockKeyhole className="mt-0.5 size-5 shrink-0 text-amber-700" /><div><p className="text-sm font-bold text-amber-900">Cambia la credencial inicial</p><p className="mt-1 text-xs leading-5 text-amber-800">Usa una frase única de al menos 14 caracteres. Nunca se almacenará el texto original; solo un hash bcrypt.</p></div></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <label className="block text-xs font-bold text-slate-600">Contraseña actual<div className="relative"><input name="currentPassword" type={showPasswords ? "text" : "password"} required autoComplete="current-password" className="form-input pr-9" /><KeyRound className="pointer-events-none absolute right-3 top-3.5 size-4 text-slate-400" /></div></label>
            <label className="block text-xs font-bold text-slate-600">Nueva contraseña<input name="newPassword" type={showPasswords ? "text" : "password"} required minLength={14} maxLength={256} autoComplete="new-password" className="form-input" /></label>
            <label className="block text-xs font-bold text-slate-600">Confirmar<input name="confirmation" type={showPasswords ? "text" : "password"} required minLength={14} maxLength={256} autoComplete="new-password" className="form-input" /></label>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={() => setShowPasswords((visible) => !visible)} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800">{showPasswords ? <EyeOff className="size-4" /> : <Eye className="size-4" />} {showPasswords ? "Ocultar" : "Mostrar"} contraseñas</button><Button type="submit" disabled={passwordPending}>{passwordPending ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Actualizar contraseña</Button></div>
        </form>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <SecurityFact icon={Database} title="PostgreSQL" detail="Datos relacionales con TLS y pooling" />
        <SecurityFact icon={LockKeyhole} title="Sesiones opacas" detail="Token aleatorio; solo el hash llega a la BD" />
        <SecurityFact icon={Check} title="CSRF y Origin" detail="Mutaciones limitadas al mismo sitio" />
      </section>
    </div>
  );
}

function SettingsHeader({ icon: Icon, title, description, action }: { icon: typeof Bot; title: string; description: string; action?: React.ReactNode }) { return <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 sm:px-6"><span className="grid size-9 place-items-center rounded-xl bg-violet-50 text-violet-600"><Icon className="size-4" /></span><div className="min-w-0 flex-1"><h2 className="text-sm font-bold text-slate-900">{title}</h2><p className="mt-0.5 truncate text-[11px] text-slate-400">{description}</p></div>{action}</div>; }
function SecurityFact({ icon: Icon, title, detail }: { icon: typeof Database; title: string; detail: string }) { return <div className="surface flex items-center gap-3 p-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Icon className="size-4" /></span><div><p className="text-xs font-bold text-slate-800">{title}</p><p className="mt-0.5 text-[10px] text-slate-400">{detail}</p></div></div>; }
function humanize(value: string) { return value.toLowerCase().replaceAll("_", " "); }
