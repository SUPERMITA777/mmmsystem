'use server';

import { createClient } from '@supabase/supabase-js';

// Since we are in Server Actions, we must bypass RLS for inserting predictions if public can't insert directly.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function submitPrediction(formData: FormData) {
  const partido_id = formData.get('partido_id') as string;
  const nombre_cliente = formData.get('nombre_cliente') as string;
  const whatsapp = formData.get('whatsapp') as string;
  const prediccion_local = parseInt(formData.get('prediccion_local') as string, 10);
  const prediccion_visitante = parseInt(formData.get('prediccion_visitante') as string, 10);
  const sucursal_id = formData.get('sucursal_id') as string;
  const tenant = formData.get('tenant') as string;

  // Generate alphanumeric code (4 chars)
  const codigo_alfanumerico = Math.random().toString(36).substring(2, 6).toUpperCase();

  // Validate format
  if (!whatsapp || !whatsapp.match(/^\d+$/)) {
    return { success: false, error: 'Número de WhatsApp inválido (solo números, con código de país).' };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('mundial_predicciones')
      .insert({
        sucursal_id,
        partido_id,
        nombre_cliente,
        whatsapp,
        prediccion_local,
        prediccion_visitante,
        codigo_alfanumerico,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // unique violation
        return { success: false, error: 'Ya has enviado una predicción para este partido con este número en este local.' };
      }
      if (error.message.includes('No se pueden hacer ni modificar predicciones')) {
        return { success: false, error: 'El partido ya ha comenzado, no se admiten más predicciones.' };
      }
      console.error('Supabase error:', error);
      return { success: false, error: 'Hubo un error al guardar la predicción.' };
    }

    // Attempt to notify via Baileys API
    try {
      const waUrl = process.env.WHATSAPP_SERVICE_URL;
      if (waUrl) {
        await fetch(waUrl + '/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            numero: whatsapp,
            mensaje: `¡Hola ${nombre_cliente}! Tu predicción de ${prediccion_local} - ${prediccion_visitante} en ${tenant} ha sido registrada. Tu código es: ${codigo_alfanumerico}`
          })
        });
        // Marcar como enviado si no falla
        await supabaseAdmin.from('mundial_predicciones').update({ whatsapp_enviado: true }).eq('id', data.id);
      }
    } catch (waError) {
      console.error('WhatsApp sending failed:', waError);
      // It's ok, whatsapp_enviado will remain false, the code is shown on screen
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, error: 'Error interno del servidor.' };
  }
}
