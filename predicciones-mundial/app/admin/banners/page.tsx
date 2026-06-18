import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { toggleBanner } from './actions';

export default async function AdminBanners() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/admin/login');
  }

  const { data: banners } = await supabase
    .from('banners')
    .select('*')
    .order('fecha_creacion', { ascending: false });

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Banners (Auspiciantes)</h1>
          <a href="/admin" className="text-blue-600 hover:text-blue-800 font-medium">Volver al Dashboard</a>
        </div>

        {/* Note: In a full implementation, add an upload form here that pushes to Supabase Storage */}
        
        <div className="bg-white shadow overflow-hidden sm:rounded-md mt-6">
          <ul className="divide-y divide-gray-200">
            {banners?.map((banner) => (
              <li key={banner.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={banner.imagen_url} alt="banner" className="h-16 w-32 object-cover rounded border" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{banner.nombre_anunciante}</p>
                    <p className="text-xs text-gray-500">Link: {banner.link_destino || 'N/A'}</p>
                    <p className="text-xs text-gray-500">Estado: {banner.activo ? 'Activo' : 'Inactivo'}</p>
                  </div>
                </div>
                <div>
                  <form action={toggleBanner}>
                    <input type="hidden" name="id" value={banner.id} />
                    <input type="hidden" name="activo" value={banner.activo ? 'false' : 'true'} />
                    <button type="submit" className={`px-3 py-1 rounded text-sm text-white ${banner.activo ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}>
                      {banner.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
          {(!banners || banners.length === 0) && (
             <div className="p-6 text-center text-gray-500">No hay banners registrados.</div>
          )}
        </div>
      </div>
    </div>
  );
}
