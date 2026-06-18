import { supabase } from '@/lib/supabaseClient';

export default async function AdminBanners({ params }: { params: Promise<{ tenant: string }> }) {
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

  const { data: banners } = await supabase
    .from('mundial_banners')
    .select('*')
    .eq('sucursal_id', sucursalId)
    .order('created_at', { ascending: false });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Banners</h1>
        <a href={`/${tenant}/admin/mundial`} className="text-blue-600 hover:text-blue-800 font-medium">Volver al Dashboard</a>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {banners?.map((banner) => (
            <li key={banner.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-600 truncate">
                    {banner.nombre_anunciante}
                  </p>
                  <p className="mt-2 flex items-center text-sm text-gray-500">
                    Activo: {banner.activo ? 'Sí' : 'No'} | Link: {banner.link_destino}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {(!banners || banners.length === 0) && (
            <div className="p-6 text-center text-gray-500">No hay banners registrados.</div>
        )}
      </div>
    </div>
  );
}
