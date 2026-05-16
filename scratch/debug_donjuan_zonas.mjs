import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
let envContent = fs.readFileSync(envPath, 'utf8');
const URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const KEY = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function run() {
    const res = await fetch(`${URL}/rest/v1/zonas_entrega?select=*&sucursal_id=eq.15cc8387-26f9-457c-b27e-f3029d1654f2`, {
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
    });
    const zonas = await res.json();
    console.dir(zonas, { depth: null });
}
run();
