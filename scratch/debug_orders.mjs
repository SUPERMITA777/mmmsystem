import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
let envContent = fs.readFileSync(envPath, 'utf8');
const URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const KEY = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function run() {
    const res = await fetch(`${URL}/rest/v1/pedidos?select=id,numero_pedido,sucursal_id,cliente_nombre&numero_pedido=in.(0007,0003)&order=created_at.desc`, {
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
    });
    const pedidos = await res.json();
    console.dir(pedidos, { depth: null });
}
run();
