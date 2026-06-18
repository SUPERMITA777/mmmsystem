'use server';

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function createBanner(formData: FormData) {
  const nombre_anunciante = formData.get('nombre_anunciante') as string;
  const imagen_url = formData.get('imagen_url') as string;
  const link_destino = formData.get('link_destino') as string;
  const sucursal_id = formData.get('sucursal_id') as string;
  const tenant = formData.get('tenant') as string;

  if (!nombre_anunciante || !imagen_url || !sucursal_id) {
    return { success: false, error: 'Faltan campos requeridos (nombre, imagen, sucursal)' };
  }

  const cookieStore = await cookies()
  const supabaseAdmin = createServerClient(supabaseUrl, supabaseServiceKey, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll() {}
    }
  });

  const { error } = await supabaseAdmin
    .from('mundial_banners')
    .insert({
      sucursal_id,
      nombre_anunciante,
      imagen_url,
      link_destino: link_destino || null,
      activo: true
    });

  if (error) {
    console.error('Error creating banner:', error);
    return { success: false, error: 'Error al crear el banner' };
  }

  revalidatePath(`/${tenant}/admin/mundial/banners`);
  revalidatePath(`/${tenant}/mundial`);
  return { success: true };
}
