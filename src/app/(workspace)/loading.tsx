export default function WorkspaceLoading() {
  return (
    <div className="mx-auto max-w-[1400px] animate-pulse space-y-6 p-6 lg:p-8" aria-label="Cargando">
      <div className="h-8 w-64 rounded-xl bg-slate-200" />
      <div className="h-4 w-96 max-w-full rounded-lg bg-slate-100" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 rounded-2xl bg-white ring-1 ring-slate-200" />)}</div>
      <div className="grid gap-5 xl:grid-cols-2"><div className="h-96 rounded-2xl bg-white ring-1 ring-slate-200" /><div className="h-96 rounded-2xl bg-white ring-1 ring-slate-200" /></div>
    </div>
  );
}

