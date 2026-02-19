export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-50">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">MMM SYSTEM DELIVERY</h1>
        <p className="text-slate-400">
          POS en la nube para delivery, salón y mostrador.
        </p>
        <a
          href="/admin"
          className="inline-flex items-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
        >
          Ir al panel de administración
        </a>
      </div>
    </main>
  );
}

