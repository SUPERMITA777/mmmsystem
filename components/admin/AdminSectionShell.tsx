export function AdminSectionShell({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
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
        {children}
      </div>
    </section>
  );
}

