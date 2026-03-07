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
    const prods = await fetchSupabase('productos', 'select=id,nombre&nombre=ilike.*Muzzarella*');
    console.log("Muzzarella products:")
    prods.forEach(p => console.log(p.nombre, p.id));
}
run();
