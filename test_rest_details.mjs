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
    const roma = cats.find(c => c.nombre.toUpperCase().includes('ROMANA'));

    if (roma) {
        const prods = await fetchSupabase('productos', `select=id,nombre&categoria_id=eq.${roma.id}`);
        const pIds = prods.map(p => p.id);
        const rels = await fetchSupabase('producto_grupos_adicionales', `select=producto_id,grupo_id&producto_id=in.(${pIds.join(',')})`);

        console.log(`\nROMA products with relations:`);
        const prodsWithRels = rels.map(r => r.producto_id);
        prods.forEach(p => {
            const groups = rels.filter(r => r.producto_id === p.id);
            console.log(` - ${p.nombre}: ${groups.length} groups`);
        });
    }
}
run();
