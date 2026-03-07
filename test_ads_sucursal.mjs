import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
let envContent = fs.readFileSync(envPath, 'utf8');
const URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const KEY = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function fetchSupabase(table, query = '') {
    const res = await fetch(`${URL}/rest/v1/${table}?${query}`, {
        headers: {
            'apikey': KEY,
            'Authorization': `Bearer ${KEY}`
        }
    });
    return res.json();
}

async function run() {
    const ads = await fetchSupabase('adicionales', 'select=id,nombre,grupo_id,sucursal_id');
    const withSuc = ads.filter(a => !!a.sucursal_id);
    const withoutSuc = ads.filter(a => !a.sucursal_id);
    console.log(`With Sucursal: ${withSuc.length}. Without: ${withoutSuc.length}`);
    if (withoutSuc.length > 0) {
        console.log("Some without sucursal:", withoutSuc.slice(0, 5));
    }
}
run();
