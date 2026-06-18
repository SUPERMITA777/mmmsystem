'use server';

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function upsertPremio(formData: FormData) {
  const partido_id = formData.get('partido_id') as string;
  const nombre = formData.get('nombre') as string;
  const descripcion = formData.get('descripcion') as string;
  const sucursal_id = formData.get('sucursal_id') as string;
  const tenant = formData.get('tenant') as string;

  if (!partido_id || !nombre || !sucursal_id) {
    return { success: false, error: 'Faltan campos requeridos' };
  }

  const cookieStore = await cookies()
  const supabaseAdmin = createServerClient(supabaseUrl, supabaseServiceKey, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll() {}
    }
  });

  const { error } = await supabaseAdmin
    .from('mundial_premios')
    .upsert({
      sucursal_id,
      partido_id,
      nombre,
      descripcion,
    }, {
      onConflict: 'sucursal_id, partido_id'
    });

  if (error) {
    console.error('Error upserting premio:', error);
    return { success: false, error: 'Error al guardar el premio' };
  }

  revalidatePath(`/${tenant}/admin/mundial/premios`);
  return { success: true };
}
