import { supabase } from '@/lib/supabaseClient';
import CanjearForm from '@/components/mundial/CanjearForm';

export default async function CanjearPage({ params }: { params: Promise<{ tenant: string }> }) {
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

  return <CanjearForm sucursalId={sucursal.id} tenant={tenant} />;
}
