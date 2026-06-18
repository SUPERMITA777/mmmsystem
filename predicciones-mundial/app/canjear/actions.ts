'use server';

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// We use service key for this to update the database since the user is not authenticated
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function canjearCodigo(formData: FormData) {
  const codigo = formData.get('codigo') as string;

  if (!codigo || codigo.trim().length !== 6) {
    return { success: false, error: 'El código debe tener 6 caracteres.' };
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(supabaseUrl, supabaseServiceKey, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll() {} // service role operations don't set user cookies
    }
  })

  // 1. Find prediction
  const { data: prediccion, error: predError } = await supabase
    .from('predicciones')
    .select(`
      id, 
      codigo_alfanumerico, 
      es_acierto_exacto, 
      es_acierto_parcial, 
      premio_canjeado,
      partido_id,
      partidos (
        fecha_hora
      )
    `)
    .eq('codigo_alfanumerico', codigo.toUpperCase())
    .single();

  if (predError || !prediccion) {
    return { success: false, error: 'Código no encontrado o inválido.' };
  }

  if (!prediccion.es_acierto_exacto && !prediccion.es_acierto_parcial) {
    return { success: false, error: 'Esta predicción no resultó ganadora. ¡Sigue participando!' };
  }

  if (prediccion.premio_canjeado) {
    return { success: false, error: 'Este premio ya ha sido canjeado anteriormente.' };
  }

  // 2. Determine daily prize based on match date
  // For simplicity, we just use the date of the match.
  const partidoData: any = prediccion.partidos;
  const fechaHora = Array.isArray(partidoData) ? partidoData[0].fecha_hora : partidoData.fecha_hora;
  const matchDate = new Date(fechaHora).toISOString().split('T')[0];
  
  const { data: premios, error: premiosError } = await supabase
    .from('premios')
    .select('*')
    .lte('fecha', matchDate) // Find the prize for that date or the latest one before it
    .order('fecha', { ascending: false })
    .limit(1);

  const premio = premios?.[0];
  if (!premio) {
    return { success: false, error: 'No hay premios configurados para esta fecha.' };
  }

  // 3. Mark as redeemed
  const { error: updateError } = await supabase
    .from('predicciones')
    .update({ 
      premio_canjeado: true,
      fecha_canje: new Date().toISOString()
    })
    .eq('id', prediccion.id);

  if (updateError) {
    return { success: false, error: 'Error al procesar el canje. Intente nuevamente.' };
  }

  return { 
    success: true, 
    data: {
      premio_nombre: premio.nombre,
      premio_descripcion: premio.descripcion
    } 
  };
}
