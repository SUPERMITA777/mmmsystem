import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
let envContent = fs.readFileSync(envPath, 'utf8');

const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const URL = urlMatch ? urlMatch[1].trim() : '';
const KEY = keyMatch ? keyMatch[1].trim() : '';

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
    const cats = await fetchSupabase('categorias', 'select=id,nombre');
    const napo = cats.find(c => c.nombre.toUpperCase().includes('NAPOLETANO'));
    const roma = cats.find(c => c.nombre.toUpperCase().includes('ROMANA'));

    console.log(`NAPO: ${napo?.id} - ${napo?.nombre}`);
    console.log(`ROMA: ${roma?.id} - ${roma?.nombre}`);

    if (napo) {
        const prods = await fetchSupabase('productos', `select=id,nombre&categoria_id=eq.${napo.id}`);
        console.log(`\nNAPO products: ${prods.length}`);
        if (prods.length > 0) {
            const pIds = prods.map(p => p.id);
            const rels = await fetchSupabase('producto_grupos_adicionales', `select=producto_id,grupo_id&producto_id=in.(${pIds.join(',')})`);
            console.log(`NAPO relations count: ${rels.length}`);
        }
    }

    if (roma) {
        const prods = await fetchSupabase('productos', `select=id,nombre&categoria_id=eq.${roma.id}`);
        console.log(`\nROMA products: ${prods.length}`);
        if (prods.length > 0) {
            prods.forEach(p => console.log(` - ${p.nombre}`));
            const pIds = prods.map(p => p.id);
            const rels = await fetchSupabase('producto_grupos_adicionales', `select=producto_id,grupo_id&producto_id=in.(${pIds.join(',')})`);
            console.log(`ROMA relations count: ${rels.length}`);
        }
    }
}
run();
