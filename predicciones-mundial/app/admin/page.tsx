import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { logout } from './login/actions';

export default async function AdminDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/admin/login');
  }

  // Fetch some stats for the dashboard
  const { count: prediccionesCount } = await supabase
    .from('predicciones')
    .select('*', { count: 'exact', head: true });

  const { count: partidosCount } = await supabase
    .from('partidos')
    .select('*', { count: 'exact', head: true });

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-blue-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">Admin Panel - Predicciones</h1>
            </div>
            <div className="flex items-center">
              <span className="mr-4 text-sm">{user.email}</span>
              <form action={logout}>
                <button type="submit" className="bg-blue-800 hover:bg-blue-700 px-3 py-2 rounded text-sm font-medium">
                  Cerrar Sesión
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <dt className="text-sm font-medium text-gray-500 truncate">Total Predicciones</dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">{prediccionesCount || 0}</dd>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <dt className="text-sm font-medium text-gray-500 truncate">Total Partidos</dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">{partidosCount || 0}</dd>
              </div>
            </div>
          </div>

          <div className="bg-white shadow sm:rounded-lg mb-8">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Módulos Administrativos</h3>
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <a href="/admin/partidos" className="flex items-center justify-center px-4 py-4 border border-gray-200 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                  Gestionar Partidos y Resultados
                </a>
                <a href="/admin/predicciones" className="flex items-center justify-center px-4 py-4 border border-gray-200 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                  Ver y Editar Predicciones
                </a>
                <a href="/admin/banners" className="flex items-center justify-center px-4 py-4 border border-gray-200 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                  Gestionar Banners
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
