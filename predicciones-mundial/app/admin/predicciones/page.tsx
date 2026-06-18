import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { editPrediction } from './actions';

export default async function AdminPredicciones() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/admin/login');
  }

  const { data: predicciones, error } = await supabase
    .from('predicciones')
    .select(`
      *,
      partidos ( equipo_local, equipo_visitante )
    `)
    .order('fecha_creacion', { ascending: false });

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Predicciones</h1>
          <a href="/admin" className="text-blue-600 hover:text-blue-800 font-medium">Volver al Dashboard</a>
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
                      Partido: {prediccion.partidos?.equipo_local} vs {prediccion.partidos?.equipo_visitante}
                      <span className="ml-4">Predicción: {prediccion.prediccion_local} - {prediccion.prediccion_visitante}</span>
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      Código: {prediccion.codigo_alfanumerico} | Enviado WA: {prediccion.whatsapp_enviado ? 'Sí' : 'No'}
                    </p>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <form action={editPrediction} className="flex gap-2">
                      <input type="hidden" name="id" value={prediccion.id} />
                      <input 
                        type="text" 
                        name="nuevo_nombre" 
                        defaultValue={prediccion.nombre_cliente} 
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                        placeholder="Nombre"
                      />
                      <input 
                        type="text" 
                        name="nuevo_whatsapp" 
                        defaultValue={prediccion.whatsapp} 
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                        placeholder="WhatsApp"
                      />
                      <label className="flex items-center text-xs text-gray-600 gap-1 ml-2">
                        <input type="checkbox" name="reenviar_wa" value="true" />
                        Reenviar WA
                      </label>
                      <button type="submit" className="ml-2 bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-sm">
                        Actualizar
                      </button>
                    </form>
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
    </div>
  );
}
