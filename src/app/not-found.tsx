import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

export default function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <div className="max-w-md text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-violet-100 text-violet-600"><SearchX className="size-7" /></span>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-violet-600">Error 404</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">No encontramos ese recurso</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">Puede haber sido archivado o no pertenecer a tu espacio de trabajo.</p>
        <Link href="/" className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700"><ArrowLeft className="size-4" /> Volver al resumen</Link>
      </div>
    </main>
  );
}
