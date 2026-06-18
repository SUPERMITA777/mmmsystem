'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function editPrediction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('No autorizado');
  }

  const id = formData.get('id') as string;
  const nuevo_nombre = formData.get('nuevo_nombre') as string;
  const nuevo_whatsapp = formData.get('nuevo_whatsapp') as string;
  const reenviar_wa = formData.get('reenviar_wa') === 'true';

  // Obtener prediccion actual
  const { data: prediccion } = await supabase
    .from('predicciones')
    .select('*')
    .eq('id', id)
    .single();

  if (!prediccion) throw new Error('No encontrada');

  let changed = false;
  const updates: any = {};
  
  if (prediccion.nombre_cliente !== nuevo_nombre) {
    updates.nombre_cliente = nuevo_nombre;
    changed = true;
  }
  if (prediccion.whatsapp !== nuevo_whatsapp) {
    updates.whatsapp = nuevo_whatsapp;
    changed = true;
  }

  if (changed) {
    // Audit logs
    if (updates.nombre_cliente) {
      await supabase.from('predicciones_auditoria').insert({
        prediccion_id: id,
        campo_modificado: 'nombre_cliente',
        valor_anterior: prediccion.nombre_cliente,
        valor_nuevo: nuevo_nombre,
        usuario_admin: user.id
      });
    }
    if (updates.whatsapp) {
      await supabase.from('predicciones_auditoria').insert({
        prediccion_id: id,
        campo_modificado: 'whatsapp',
        valor_anterior: prediccion.whatsapp,
        valor_nuevo: nuevo_whatsapp,
        usuario_admin: user.id
      });
    }

    // Actualizar registro
    await supabase.from('predicciones').update(updates).eq('id', id);
  }

  if (reenviar_wa) {
    const targetWhatsapp = updates.whatsapp || prediccion.whatsapp;
    const targetNombre = updates.nombre_cliente || prediccion.nombre_cliente;
    try {
      await fetch(process.env.WHATSAPP_SERVICE_URL + '/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero: targetWhatsapp,
          mensaje: `[Reenvío] ¡Hola ${targetNombre}! Tu código de predicción es: ${prediccion.codigo_alfanumerico}`
        })
      });
    } catch (e) {
      console.error('Error reenviando WA', e);
    }
  }

  revalidatePath('/admin/predicciones');
}
