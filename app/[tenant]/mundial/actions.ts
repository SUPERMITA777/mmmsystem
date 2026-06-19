'use server';

import { createClient } from '@supabase/supabase-js';

// Since we are in Server Actions, we must bypass RLS for inserting predictions if public can't insert directly.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function submitBulkPredictions(data: {
  sucursal_id: string;
  tenant: string;
  nombre_cliente: string;
  whatsapp: string;
  predicciones: { partido_id: string; prediccion_local: number; prediccion_visitante: number }[];
}) {
  const { sucursal_id, tenant, nombre_cliente, whatsapp, predicciones } = data;

  if (!whatsapp || !whatsapp.match(/^\d+$/)) {
    return { success: false, error: 'Número de WhatsApp inválido (solo números, con código de país).' };
  }

  if (!predicciones || predicciones.length === 0) {
    return { success: false, error: 'Debes enviar al menos una predicción.' };
  }

  try {
    // Generate a single code for all predictions in this batch?
    // Wait, the client expects `codigo_alfanumerico`. A unique code is generated for each prediction row, but maybe we generate one code for the whole batch so the user can claim all prizes with it.
    // Or we generate a single code per match. Let's use one single code for this bulk submission for simplicity.
    const codigo_alfanumerico = Math.random().toString(36).substring(2, 6).toUpperCase();

    const insertData = predicciones.map(p => ({
      sucursal_id,
      partido_id: p.partido_id,
      nombre_cliente,
      whatsapp,
      prediccion_local: p.prediccion_local,
      prediccion_visitante: p.prediccion_visitante,
      codigo_alfanumerico,
      whatsapp_enviado_count: 0
    }));

    // Upsert or Insert. We need to handle conflicts. Since (sucursal_id, partido_id, whatsapp) is unique,
    // if one fails, maybe all fail? Let's use raw insert.
    const { data: insertedData, error } = await supabaseAdmin
      .from('mundial_predicciones')
      .insert(insertData)
      .select();

    if (error) {
      if (error.code === '23505') { // unique violation
        return { success: false, error: 'Ya has enviado una predicción para uno de estos partidos con este número.' };
      }
      if (error.message.includes('No se pueden hacer ni modificar predicciones')) {
        return { success: false, error: 'Uno o más partidos ya han comenzado.' };
      }
      console.error('Supabase error:', error);
      return { success: false, error: 'Hubo un error al guardar las predicciones.' };
    }

    // Return the code to the frontend so it can display it
    return { success: true, data: { codigo_alfanumerico } };
  } catch (err) {
    console.error('Internal error:', err);
    return { success: false, error: 'Error interno del servidor.' };
  }
}
