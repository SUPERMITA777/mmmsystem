'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function updateSEO(formData: FormData) {
  const sucursal_id = formData.get('sucursal_id') as string;
  const tenant = formData.get('tenant') as string;
  const mundial_og_title = formData.get('mundial_og_title') as string;
  const mundial_og_description = formData.get('mundial_og_description') as string;

  if (!sucursal_id) return { success: false, error: 'Falta ID de sucursal' };

  const cookieStore = await cookies();
  const supabaseAdmin = createServerClient(supabaseUrl, supabaseServiceKey, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll() {}
    }
  });

  const { error } = await supabaseAdmin
    .from('sucursales')
    .update({
      mundial_og_title,
      mundial_og_description
    })
    .eq('id', sucursal_id);

  if (error) {
    console.error('Error updating SEO:', error);
    return { success: false, error: 'Error al actualizar configuración SEO' };
  }

  revalidatePath(`/${tenant}/mundial`);
  revalidatePath(`/${tenant}/admin/mundial/ajustes`);
  return { success: true };
}
