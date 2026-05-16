import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data: sucursales } = await supabase.from('sucursales').select('*').in('slug', ['mmm', 'donjuan', 'don-juan']);
  console.log("Sucursales:", sucursales);
  
  if (sucursales && sucursales.length > 0) {
    const ids = sucursales.map(s => s.id);
    const { data: configs } = await supabase.from('config_sucursal').select('sucursal_id, local_lat, local_lng').in('sucursal_id', ids);
    console.log("Configs:", configs);

    const { data: zonas } = await supabase.from('zonas_entrega').select('sucursal_id, nombre, id').in('sucursal_id', ids);
    console.log("Zonas:", zonas);
  }
}
check();
