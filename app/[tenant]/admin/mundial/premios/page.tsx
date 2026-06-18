import { supabase } from '@/lib/supabaseClient';
import PremiosForm from '@/components/admin/PremiosForm';

export default async function AdminPremios({ params }: { params: Promise<{ tenant: string }> }) {
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

  // Obtener partidos para el dropdown
  const { data: partidos } = await supabase
    .from('mundial_partidos')
    .select('*')
    .order('fecha_hora', { ascending: true });

  // Obtener premios configurados
  const { data: premios } = await supabase
    .from('mundial_premios')
    .select('*, mundial_partidos(equipo_local, equipo_visitante, fecha_hora)')
    .eq('sucursal_id', sucursalId)
    .order('creado_en', { ascending: false });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Premios</h1>
        <a href={`/${tenant}/admin/mundial`} className="text-blue-600 hover:text-blue-800 font-medium">Volver al Dashboard</a>
      </div>

      <PremiosForm partidos={partidos || []} sucursalId={sucursalId} tenant={tenant} />

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {premios?.map((premio: any) => (
            <li key={premio.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {premio.mundial_partidos?.equipo_local} vs {premio.mundial_partidos?.equipo_visitante}
                </p>
                <p className="text-xs text-gray-500 mb-2">
                  Partido: {premio.mundial_partidos?.fecha_hora ? premio.mundial_partidos.fecha_hora.split('T')[0] : ''}
                </p>
                <p className="text-sm text-gray-700"><span className="font-bold">Premio:</span> {premio.nombre}</p>
                {premio.descripcion && (
                  <p className="text-sm text-gray-500 italic mt-1">{premio.descripcion}</p>
                )}
              </div>
            </li>
          ))}
          {(!premios || premios.length === 0) && (
            <li className="p-4 text-center text-gray-500">No hay premios configurados.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
