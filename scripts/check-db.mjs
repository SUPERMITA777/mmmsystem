import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    const { data: sucursales } = await supabase.from('sucursales').select('*');
    console.log('Sucursales:', JSON.stringify(sucursales, null, 2));

    const { data: metodos } = await supabase.from('metodos_pago').select('*');
    console.log('Metodos de Pago:', JSON.stringify(metodos, null, 2));
}

check();
