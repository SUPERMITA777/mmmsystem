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
    // 1. Get Product
    const p = await fetchSupabase('productos', 'select=id,nombre&nombre=ilike.*Muzzarella*-*ROMANA*');
    if (!p.length) return console.log("Product not found");
    const pId = p[0].id;
    console.log(`Product: ${pId} - ${p[0].nombre}`);

    // 2. Get Groups Assigments
    const rels = await fetchSupabase('producto_grupos_adicionales', `select=grupo_id&producto_id=eq.${pId}`);
    console.log(`Relations:`, rels);
    if (!rels.length) return;
    const gIds = rels.map(r => r.grupo_id);

    // 3. Get Additional Groups Data
    const groups = await fetchSupabase('grupos_adicionales', `select=*&id=in.(${gIds.join(',')})`);
    console.log(`Groups:`, groups);

    // 4. Get Adicionales (Options) data for these groups
    const ads = await fetchSupabase('adicionales', `select=*&grupo_id=in.(${gIds.join(',')})`);
    console.log(`Adicionales per group:`);
    groups.forEach(g => {
        const matchingAds = ads.filter(a => a.grupo_id === g.id);
        console.log(` - Group ${g.nombre}: has ${matchingAds.length} items. Visible items: ${matchingAds.filter(a => a.visible).length}`);
    });
}
run();
