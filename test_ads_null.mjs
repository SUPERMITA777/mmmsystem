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
    const ads = await fetchSupabase('adicionales', 'select=id,nombre,grupo_id,sucursal_id&grupo_id=eq.214c3379-b9e1-44a6-a080-942e3b5e2143');
    console.log("Ads for group 214c... :", ads);
}
run();
