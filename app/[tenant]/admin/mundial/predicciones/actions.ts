'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function incrementWhatsAppCount(prediccionId: string) {
  // Call an RPC or just read/update.
  // The simplest is to read the current value and update, 
  // or use an RPC. Since we don't have an RPC, we read then write.
  
  const { data } = await supabaseAdmin
    .from('mundial_predicciones')
    .select('whatsapp_enviado_count')
    .eq('id', prediccionId)
    .single();

  if (data) {
    const currentCount = data.whatsapp_enviado_count || 0;
    await supabaseAdmin
      .from('mundial_predicciones')
      .update({ whatsapp_enviado_count: currentCount + 1 })
      .eq('id', prediccionId);
  }
}
