'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function toggleBanner(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('No autorizado');

  const id = formData.get('id') as string;
  const activo = formData.get('activo') === 'true';

  await supabase.from('banners').update({ activo }).eq('id', id);
  revalidatePath('/admin/banners');
  // Also revalidate the home page so banners update there
  revalidatePath('/');
}
