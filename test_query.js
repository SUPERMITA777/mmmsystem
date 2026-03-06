import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'd:/zzz MMMSYSTEM/.env.example' });
dotenv.config({ path: 'd:/zzz MMMSYSTEM/.env', override: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data, error } = await supabase
        .from('pedidos')
        .select(`
            id,
            pedido_items (
                id,
                nombre_producto,
                productos (
                    categorias (
                        nombre
                    )
                )
            )
        `)
        .limit(1);

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Success:", JSON.stringify(data, null, 2));
    }
}
test();
