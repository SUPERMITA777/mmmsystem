import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import PremioInlineForm from '@/components/admin/PremioInlineForm';

export default async function AdminPartidos({ params }: { params: Promise<{ tenant: string }> }) {
  const resolvedParams = await params;
  const tenant = resolvedParams.tenant;

  const { data: sucursal } = await supabase
    .from('sucursales')
    .select('id')
    .eq('slug', tenant)
    .single();

  if (!sucursal) return <div>Sucursal no encontrada</div>;
  const sucursalId = sucursal.id;

  // Obtener partidos
  const { data: partidos } = await supabase
    .from('mundial_partidos')
    .select('*')
    .order('fecha_hora', { ascending: true });

  // Obtener premios para esta sucursal
  const { data: premios } = await supabase
    .from('mundial_premios')
    .select('*')
    .eq('sucursal_id', sucursalId);

  // Obtener conteo de ganadores por partido (puntos_obtenidos > 0)
  const { data: predicciones } = await supabase
    .from('mundial_predicciones')
    .select('partido_id, puntos_obtenidos')
    .eq('sucursal_id', sucursalId)
    .gt('puntos_obtenidos', 0);

  const winnersCount: Record<string, number> = {};
  if (predicciones) {
    predicciones.forEach(p => {
      winnersCount[p.partido_id] = (winnersCount[p.partido_id] || 0) + 1;
    });
  }

  const premiosMap: Record<string, any> = {};
  if (premios) {
    premios.forEach(p => {
      premiosMap[p.partido_id] = p;
    });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Partidos y Premios</h1>
        <Link href={`/${tenant}/admin/mundial`} className="text-blue-600 hover:text-blue-800 font-medium">Volver al Dashboard</Link>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {partidos?.map((partido) => {
            const premio = premiosMap[partido.id];
            const isStarted = new Date() >= new Date(partido.fecha_hora);
            const winners = winnersCount[partido.id] || 0;

            return (
              <li key={partido.id} className="p-4 hover:bg-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-bold text-blue-900">
                      {partido.equipo_local} vs {partido.equipo_visitante}
                    </p>
                    {isStarted ? (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold">En Juego / Finalizado</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-bold">Pendiente</span>
                    )}
                  </div>
                  <p className="mt-1 flex items-center text-sm text-gray-500">
                    Fecha: {new Date(partido.fecha_hora).toLocaleString('es-AR')}
                  </p>
                  {partido.resultado_local !== null && (
                    <p className="mt-1 text-sm font-bold text-gray-700">
                      Resultado Final: {partido.resultado_local} - {partido.resultado_visitante}
                    </p>
                  )}
                  {partido.resultado_local !== null && (
                    <p className="mt-1 text-sm text-green-600 font-semibold">
                      🏆 Ganadores: {winners} personas acertaron
                    </p>
                  )}
                </div>
                
                <div className="w-full md:w-1/3 bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 className="text-sm font-bold text-gray-700 mb-2">Premio del Partido</h4>
                  <PremioInlineForm 
                    partidoId={partido.id} 
                    sucursalId={sucursalId} 
                    tenant={tenant} 
                    initialPremio={premio} 
                  />
                </div>
              </li>
            );
          })}
        </ul>
        {(!partidos || partidos.length === 0) && (
            <div className="p-6 text-center text-gray-500">No hay partidos registrados.</div>
        )}
      </div>
    </div>
  );
}
