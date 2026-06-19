import { supabase } from '@/lib/supabaseClient';
import WhatsAppButton from '@/components/admin/WhatsAppButton';

export default async function AdminPredicciones({ params }: { params: Promise<{ tenant: string }> }) {
  const resolvedParams = await params;
  const tenant = resolvedParams.tenant;

  const { data: sucursal } = await supabase
    .from('sucursales')
    .select('id')
    .eq('slug', tenant)
    .single();

  if (!sucursal) {
    return <div>Sucursal no encontrada</div>;
  }
  const sucursalId = sucursal.id;

  const { data: predicciones, error } = await supabase
    .from('mundial_predicciones')
    .select(`
      *,
      mundial_partidos ( equipo_local, equipo_visitante )
    `)
    .eq('sucursal_id', sucursalId)
    .order('fecha_creacion', { ascending: false });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Predicciones</h1>
        <a href={`/${tenant}/admin/mundial`} className="text-blue-600 hover:text-blue-800 font-medium">Volver al Dashboard</a>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {predicciones?.map((prediccion) => (
            <li key={prediccion.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-600 truncate">
                    {prediccion.nombre_cliente} ({prediccion.whatsapp})
                  </p>
                  <p className="mt-2 flex items-center text-sm text-gray-500">
                    Partido: {prediccion.mundial_partidos?.equipo_local} vs {prediccion.mundial_partidos?.equipo_visitante}
                    <span className="ml-4">Predicción: {prediccion.prediccion_local} - {prediccion.prediccion_visitante}</span>
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Código: <span className="font-bold text-gray-700">{prediccion.codigo_alfanumerico}</span> | Enviado WA: {prediccion.whatsapp_enviado ? 'Sí' : 'No'} | Puntos: {prediccion.puntos_obtenidos || 0}
                  </p>
                </div>
                <div className="ml-4 flex items-center justify-center">
                  <WhatsAppButton 
                    prediccionId={prediccion.id}
                    whatsapp={prediccion.whatsapp}
                    nombre={prediccion.nombre_cliente}
                    local={prediccion.prediccion_local}
                    visitante={prediccion.prediccion_visitante}
                    eqLocal={prediccion.mundial_partidos?.equipo_local}
                    eqVisitante={prediccion.mundial_partidos?.equipo_visitante}
                    codigo={prediccion.codigo_alfanumerico}
                    initialCount={prediccion.whatsapp_enviado_count || 0}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
        {(!predicciones || predicciones.length === 0) && (
            <div className="p-6 text-center text-gray-500">No hay predicciones registradas.</div>
        )}
      </div>
    </div>
  );
}
