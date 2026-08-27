"use client";

import { useEffect } from "react";
import { CircleAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WorkspaceError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("Workspace render failed", error);
  }, [error]);

  return (
    <div className="grid min-h-[calc(100vh-4.5rem)] place-items-center p-6">
      <div className="surface max-w-md p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-rose-50 text-rose-600"><CircleAlert className="size-6" /></span>
        <h1 className="mt-5 text-xl font-bold text-slate-900">No pudimos cargar esta vista</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">La operación falló sin exponer datos internos. Intenta nuevamente en unos segundos.</p>
        <Button onClick={retry} className="mt-6"><RefreshCw className="size-4" /> Reintentar</Button>
      </div>
    </div>
  );
}
