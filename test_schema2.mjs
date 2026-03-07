import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
let envContent = fs.readFileSync(envPath, 'utf8');
const URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const KEY = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function run() {
    const res = await fetch(`${URL}/rest/v1/producto_grupos_adicionales`, {
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
    });
    const all = await res.json();
    console.log(`Total rows: ${all.length}`);
    const withSucursal = all.filter(r => r.sucursal_id !== null);
    console.log(`Rows with sucursal_id: ${withSucursal.length}`);
}
run();
