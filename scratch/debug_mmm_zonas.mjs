import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
let envContent = fs.readFileSync(envPath, 'utf8');
const URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const KEY = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function run() {
    const res = await fetch(`${URL}/rest/v1/zonas_entrega?select=*&sucursal_id=eq.9d1bfdb8-cb79-4568-b2bc-5f04f1888462`, {
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
    });
    const zonas = await res.json();
    console.dir(zonas, { depth: null });
}
run();
