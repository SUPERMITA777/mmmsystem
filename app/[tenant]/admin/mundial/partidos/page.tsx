import { supabase } from '@/lib/supabaseClient';

export default async function AdminPartidos({ params }: { params: Promise<{ tenant: string }> }) {
  const resolvedParams = await params;
  const tenant = resolvedParams.tenant;

  const { data: partidos } = await supabase
    .from('mundial_partidos')
    .select('*')
    .order('fecha_hora', { ascending: true });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Partidos (Global)</h1>
        <a href={`/${tenant}/admin/mundial`} className="text-blue-600 hover:text-blue-800 font-medium">Volver al Dashboard</a>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {partidos?.map((partido) => (
            <li key={partido.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-600 truncate">
                    {partido.equipo_local} vs {partido.equipo_visitante}
                  </p>
                  <p className="mt-2 flex items-center text-sm text-gray-500">
                    Fecha: {new Date(partido.fecha_hora).toLocaleString('es-AR')} | Estado: {partido.estado}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Resultado Final: {partido.resultado_local ?? '?'} - {partido.resultado_visitante ?? '?'}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {(!partidos || partidos.length === 0) && (
            <div className="p-6 text-center text-gray-500">No hay partidos registrados.</div>
        )}
      </div>
    </div>
  );
}
