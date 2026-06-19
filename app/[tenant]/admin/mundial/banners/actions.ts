'use server';

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function createBanner(formData: FormData) {
  const nombre_anunciante = formData.get('nombre_anunciante') as string;
  const imagen_file = formData.get('imagen_file') as File;
  const link_destino = formData.get('link_destino') as string;
  const sucursal_id = formData.get('sucursal_id') as string;
  const tenant = formData.get('tenant') as string;

  if (!nombre_anunciante || !imagen_file || !sucursal_id) {
    return { success: false, error: 'Faltan campos requeridos (nombre, imagen, sucursal)' };
  }

  const cookieStore = await cookies()
  const supabaseAdmin = createServerClient(supabaseUrl, supabaseServiceKey, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll() {}
    }
  });

  // 1. Upload image to Supabase Storage
  const fileExt = imagen_file.name.split('.').pop();
  const fileName = `banners/${sucursal_id}_${Date.now()}.${fileExt}`;
  
  const { data: uploadData, error: uploadError } = await supabaseAdmin
    .storage
    .from('images')
    .upload(fileName, imagen_file, {
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) {
    console.error('Error uploading banner image:', uploadError);
    return { success: false, error: 'Error al subir la imagen' };
  }

  // 2. Get Public URL
  const { data: publicUrlData } = supabaseAdmin.storage.from('images').getPublicUrl(fileName);
  const imagen_url = publicUrlData.publicUrl;

  // 3. Insert into database
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
    return { success: false, error: 'Error al crear el banner en la base de datos' };
  }

  revalidatePath(`/${tenant}/admin/mundial/banners`);
  revalidatePath(`/${tenant}/mundial`);
  return { success: true };
}
