import { supabase } from '@/lib/supabaseClient';

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
                <div className="ml-4">
                  <a
                    href={`https://wa.me/${prediccion.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`¡Hola ${prediccion.nombre_cliente}! Tu predicción de ${prediccion.prediccion_local} - ${prediccion.prediccion_visitante} para el partido ${prediccion.mundial_partidos?.equipo_local} vs ${prediccion.mundial_partidos?.equipo_visitante} fue guardada con éxito. Tu código para participar es: ${prediccion.codigo_alfanumerico}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    <svg className="mr-1.5 h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.06-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                    Enviar WhatsApp
                  </a>
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
