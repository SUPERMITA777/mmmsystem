import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
let envContent = fs.readFileSync(envPath, 'utf8');
const URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const KEY = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function run() {
    console.log(`Querying: sucursales mmm`);
    const res = await fetch(`${URL}/rest/v1/sucursales?select=*&slug=in.(mmm,donjuan,don-juan)`, {
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
    });
    
    const sucursales = await res.json();
    console.dir(sucursales, { depth: null });
    
    for (const s of sucursales) {
        console.log(`Fetching config for ${s.slug} (${s.id})`);
        const res2 = await fetch(`${URL}/rest/v1/config_sucursal?select=sucursal_id,local_lat,local_lng&sucursal_id=eq.${s.id}`, {
            headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
        });
        const cfg = await res2.json();
        console.dir(cfg, { depth: null });
        
        console.log(`Fetching zonas for ${s.slug} (${s.id})`);
        const res3 = await fetch(`${URL}/rest/v1/zonas_entrega?select=id,nombre,activo,sucursal_id&sucursal_id=eq.${s.id}`, {
            headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
        });
        const zonas = await res3.json();
        console.dir(zonas, { depth: null });
    }
}
run();
