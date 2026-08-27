import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Database,
  KeyRound,
  LogIn,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/ui/section-heading";
import type { AuditAdministrationData } from "@/lib/data";

const actionLabels: Record<string, string> = {
  "admin.account_create": "Creación de cuenta",
  "admin.account_link": "Vinculación de cuenta",
  "auth.login": "Inicio de sesión",
  "auth.login.rate_limited": "Inicio bloqueado por límite",
  "auth.logout": "Cierre de sesión",
  "auth.password_change": "Cambio de contraseña",
};

const outcomeLabels = {
  SUCCESS: "Exitoso",
  FAILURE: "Fallido",
  DENIED: "Denegado",
} as const;

const outcomeStyles = {
  SUCCESS: "bg-emerald-50 text-emerald-700",
  FAILURE: "bg-amber-50 text-amber-700",
  DENIED: "bg-rose-50 text-rose-700",
} as const;

export function AuditAdministrationView({
  data,
  timeZone,
}: {
  data: AuditAdministrationData;
  timeZone: string;
}) {
  const metrics = [
    {
      label: "Cuentas activas",
      value: data.metrics.activeAccounts,
      detail: "Con perfil y contraseña habilitados",
      icon: KeyRound,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Perfiles sin cuenta",
      value: data.metrics.profilesWithoutAccount,
      detail: "Personas operativas sin acceso al sistema",
      icon: Users,
      tone: "bg-amber-50 text-amber-700",
    },
    {
      label: "Eventos en 24 horas",
      value: data.metrics.eventsLast24Hours,
      detail: "Acciones de seguridad relacionadas con el espacio",
      icon: Activity,
      tone: "bg-violet-50 text-violet-700",
    },
    {
      label: "Accesos denegados",
      value: data.metrics.deniedLast24Hours,
      detail: "Solicitudes bloqueadas durante las últimas 24 horas",
      icon: ShieldCheck,
      tone: "bg-rose-50 text-rose-700",
    },
  ] as const;

  return (
    <div className="mx-auto max-w-[1380px] space-y-7 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <SectionHeading
        eyebrow="Gobierno del espacio"
        title="Administración y auditoría"
        description="Supervisa las cuentas vinculadas y revisa los eventos de seguridad sin exponer credenciales ni datos técnicos sensibles."
        actions={(
          <Link
            href="/team"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            <Users className="size-4" /> Administrar cuentas <ArrowRight className="size-4" />
          </Link>
        )}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen de administración">
        {metrics.map(({ label, value, detail, icon: Icon, tone }) => (
          <article key={label} className="surface p-5">
            <div className={`grid size-10 place-items-center rounded-xl ${tone}`}>
              <Icon className="size-5" />
            </div>
            <p className="mt-4 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
            <h2 className="mt-1 text-xs font-bold text-slate-700">{label}</h2>
            <p className="mt-1 text-[11px] leading-4 text-slate-400">{detail}</p>
          </article>
        ))}
      </section>

      <section className="surface overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2 className="text-sm font-bold text-slate-900">Configuración de auditoría</h2>
          <p className="mt-0.5 text-xs text-slate-400">Políticas efectivas del sistema; se muestran como estado y no como controles decorativos.</p>
        </div>
        <div className="grid divide-y divide-slate-100 md:grid-cols-3 md:divide-x md:divide-y-0">
          <AuditPolicy
            icon={Activity}
            title="Registro activo"
            status="Activo"
            detail="Los accesos, cambios de contraseña y altas o vinculaciones de cuentas generan eventos de seguridad."
          />
          <AuditPolicy
            icon={ShieldCheck}
            title="Historial append-only"
            status="Protegido"
            detail="PostgreSQL rechaza la actualización o eliminación de eventos ya registrados."
          />
          <AuditPolicy
            icon={Database}
            title="Retención"
            status="Completa"
            detail="No hay borrado ni retención automática configurada; los eventos permanecen en el historial."
          />
        </div>
      </section>

      <section className="surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Eventos de seguridad</h2>
            <p className="mt-0.5 text-xs text-slate-400">Últimos {data.events.length} eventos relacionados con este espacio</p>
          </div>
          <Badge color="#6d5dfc">Solo propietario</Badge>
        </div>

        {data.events.length ? (
          <div className="app-scrollbar overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-3.5">Fecha</th>
                  <th className="px-4 py-3.5">Actor</th>
                  <th className="px-4 py-3.5">Evento</th>
                  <th className="px-4 py-3.5">Resultado</th>
                  <th className="px-6 py-3.5">Solicitud</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.events.map((event) => {
                  const Icon = event.action.includes("password")
                    ? KeyRound
                    : event.action.includes("login") || event.action.includes("logout")
                      ? LogIn
                      : ShieldCheck;
                  return (
                    <tr key={event.id} className="align-middle">
                      <td className="whitespace-nowrap px-6 py-4 text-[11px] font-medium text-slate-500">
                        <time dateTime={event.createdAt}>{formatAuditTimestamp(event.createdAt, timeZone)}</time>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2.5">
                          {event.actorName ? (
                            <Avatar name={event.actorName} color={event.actorColor} size="sm" />
                          ) : (
                            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
                              <ShieldCheck className="size-4" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="max-w-44 truncate font-bold text-slate-800">{event.actorName ?? "Sistema"}</p>
                            <p className="mt-0.5 max-w-44 truncate text-[11px] text-slate-400">
                              {event.actorUsername ? `@${event.actorUsername}` : "Sin cuenta atribuida"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Icon className="size-4 shrink-0 text-violet-500" />
                          <div>
                            <p className="font-semibold text-slate-700">{actionLabels[event.action] ?? humanizeAction(event.action)}</p>
                            <p className="mt-0.5 text-[11px] text-slate-400">{event.action}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-bold ${outcomeStyles[event.outcome]}`}>
                          {outcomeLabels[event.outcome]}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <code className="block max-w-52 truncate rounded-md bg-slate-50 px-2 py-1 text-[10px] text-slate-500" title={event.requestId}>
                          {event.requestId}
                        </code>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-14 text-center">
            <ShieldCheck className="mx-auto size-8 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">No hay eventos registrados</p>
            <p className="mt-1 text-xs text-slate-400">Los eventos de acceso y seguridad aparecerán aquí.</p>
          </div>
        )}
      </section>

      <aside className="surface flex items-start gap-4 p-5 sm:p-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-slate-800">Vista de datos minimizada</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
            Esta consola no selecciona ni transfiere valores de contraseñas, hashes de contraseña, tokens de sesión, direcciones IP, hashes de IP ni metadatos internos de los eventos.
          </p>
        </div>
      </aside>
    </div>
  );
}

function AuditPolicy({
  icon: Icon,
  title,
  status,
  detail,
}: {
  icon: typeof Activity;
  title: string;
  status: string;
  detail: string;
}) {
  return (
    <article className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-violet-50 text-violet-600">
          <Icon className="size-4" />
        </span>
        <Badge color="#0f9f7a">{status}</Badge>
      </div>
      <h3 className="mt-4 text-xs font-bold text-slate-800">{title}</h3>
      <p className="mt-1 text-[11px] leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

function humanizeAction(action: string): string {
  return action.replaceAll(".", " ").replaceAll("_", " ");
}

function formatAuditTimestamp(value: string, timeZone: string): string {
  const date = new Date(value);
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  };

  try {
    return new Intl.DateTimeFormat("es-CO", options).format(date);
  } catch {
    return new Intl.DateTimeFormat("es-CO", { ...options, timeZone: "UTC" }).format(date);
  }
}
