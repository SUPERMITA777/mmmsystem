import { supabase } from '@/lib/supabaseClient';
import SEOForm from '@/components/admin/SEOForm';

export default async function AdminAjustes({ params }: { params: Promise<{ tenant: string }> }) {
  const resolvedParams = await params;
  const tenant = resolvedParams.tenant;

  const { data: sucursal } = await supabase
    .from('sucursales')
    .select('id, mundial_og_title, mundial_og_description')
    .eq('slug', tenant)
    .single();

  if (!sucursal) {
    return <div>Sucursal no encontrada</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ajustes Generales</h1>
        <a href={`/${tenant}/admin/mundial`} className="text-blue-600 hover:text-blue-800 font-medium">Volver al Dashboard</a>
      </div>

      <SEOForm 
        sucursalId={sucursal.id} 
        tenant={tenant} 
        defaultTitle={sucursal.mundial_og_title || ''} 
        defaultDesc={sucursal.mundial_og_description || ''} 
      />
    </div>
  );
}
