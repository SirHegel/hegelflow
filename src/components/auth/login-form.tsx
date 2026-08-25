"use client";

import { type FormEvent, useState } from "react";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";

function responseMessage(payload: unknown): string | null {
  if (
    payload
    && typeof payload === "object"
    && "message" in payload
    && typeof payload.message === "string"
  ) {
    return payload.message;
  }
  return null;
}

export function LoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const username = formData.get("username");
    const password = formData.get("password");

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-Protection": "1",
        },
        body: JSON.stringify({ username, password }),
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setError(responseMessage(payload) ?? "No fue posible iniciar sesión.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("No pudimos conectar con HegelFlow. Inténtalo de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
      <div className="space-y-2">
        <label
          className="block text-sm font-semibold text-slate-700 dark:text-slate-200"
          htmlFor="username"
        >
          Usuario
        </label>
        <div className="relative">
          <UserRound
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400"
          />
          <input
            autoCapitalize="none"
            autoComplete="username"
            autoCorrect="off"
            className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white"
            disabled={pending}
            id="username"
            maxLength={64}
            name="username"
            placeholder="Tu nombre de usuario"
            required
            spellCheck={false}
            type="text"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label
          className="block text-sm font-semibold text-slate-700 dark:text-slate-200"
          htmlFor="password"
        >
          Contraseña
        </label>
        <div className="relative">
          <LockKeyhole
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400"
          />
          <input
            aria-describedby={error ? "login-error" : undefined}
            autoComplete="current-password"
            className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-12 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white"
            disabled={pending}
            id="password"
            maxLength={256}
            name="password"
            placeholder="Tu contraseña"
            required
            type={showPassword ? "text" : "password"}
          />
          <button
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:hover:bg-white/10 dark:hover:text-white"
            disabled={pending}
            onClick={() => setShowPassword((visible) => !visible)}
            type="button"
          >
            {showPassword
              ? <EyeOff aria-hidden="true" className="size-5" />
              : <Eye aria-hidden="true" className="size-5" />}
          </button>
        </div>
      </div>

      <div aria-live="polite" className="min-h-6">
        {error ? (
          <p
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200"
            id="login-error"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>

      <button
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:ring-offset-slate-950"
        disabled={pending}
        type="submit"
      >
        {pending ? (
          <>
            <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
            Verificando…
          </>
        ) : "Entrar a HegelFlow"}
      </button>
    </form>
  );
}
