export function AdminSectionShell({
  title,
  subtitle
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <section className="p-8">
      <header className="mb-4">
        <h2 className="text-2xl font-semibold">{title}</h2>
        {subtitle && (
          <p className="text-sm text-slate-500">{subtitle}</p>
        )}
      </header>
      <div className="bg-white rounded-xl border border-slate-200 p-6 min-h-[300px]">
        <p className="text-sm text-slate-400">
          Próximamente interfaz completa para {title.toLowerCase()}.
        </p>
      </div>
    </section>
  );
}

