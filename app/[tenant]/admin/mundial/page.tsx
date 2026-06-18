import { supabase } from '@/lib/supabaseClient';

export default async function AdminMundialDashboard({ params }: { params: Promise<{ tenant: string }> }) {
  const resolvedParams = await params;
  const tenant = resolvedParams.tenant;

  const { data: sucursal } = await supabase
    .from('sucursales')
    .select('id')
    .eq('slug', tenant)
    .single();

  let prediccionesCount = 0;
  let partidosCount = 0;

  if (sucursal) {
    const sucursalId = sucursal.id;

    const { count: pCount } = await supabase
      .from('mundial_predicciones')
      .select('*', { count: 'exact', head: true })
      .eq('sucursal_id', sucursalId);
    prediccionesCount = pCount || 0;

    const { count: ptCount } = await supabase
      .from('mundial_partidos')
      .select('*', { count: 'exact', head: true });
    partidosCount = ptCount || 0;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Mundial: Panel de Administración</h2>
          <p className="text-sm text-gray-500 mt-1">Gestiona las predicciones, partidos y banners de tu plataforma del mundial</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white overflow-hidden shadow-sm border border-gray-200 rounded-2xl">
          <div className="px-6 py-5">
            <dt className="text-sm font-medium text-gray-500 truncate">Total Predicciones</dt>
            <dd className="mt-1 text-3xl font-black text-gray-900">{prediccionesCount}</dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow-sm border border-gray-200 rounded-2xl">
          <div className="px-6 py-5">
            <dt className="text-sm font-medium text-gray-500 truncate">Total Partidos Activos</dt>
            <dd className="mt-1 text-3xl font-black text-gray-900">{partidosCount}</dd>
          </div>
        </div>
      </div>

      <div className="bg-white shadow-sm border border-gray-200 rounded-3xl mb-8">
        <div className="px-6 py-6 sm:p-8">
          <h3 className="text-lg leading-6 font-bold text-gray-900">Módulos</h3>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <a href={`/${tenant}/admin/mundial/partidos`} className="flex items-center justify-center px-4 py-4 border border-gray-200 rounded-xl shadow-sm text-sm font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors">
              Gestionar Partidos
            </a>
            <a href={`/${tenant}/admin/mundial/predicciones`} className="flex items-center justify-center px-4 py-4 border border-gray-200 rounded-xl shadow-sm text-sm font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors">
              Ver Predicciones
            </a>
            <a href={`/${tenant}/admin/mundial/banners`} className="flex items-center justify-center px-4 py-4 border border-gray-200 rounded-xl shadow-sm text-sm font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors">
              Gestionar Banners
            </a>
            <a href={`/${tenant}/admin/mundial/premios`} className="flex items-center justify-center px-4 py-4 border border-gray-200 rounded-xl shadow-sm text-sm font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors text-center">
              Gestionar Premios
            </a>
            <a href={`/${tenant}/admin/mundial/canjear`} className="flex items-center justify-center px-4 py-4 border border-gray-200 rounded-xl shadow-sm text-sm font-bold text-green-700 bg-green-50 hover:bg-green-100 transition-colors text-center">
              Canjear Premio (Sponsor)
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
