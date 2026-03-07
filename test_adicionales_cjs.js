const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Fetching Categories...");
    const { data: cats } = await supabase.from('categorias').select('id, nombre');
    const napoCat = cats.find(c => c.nombre.toUpperCase().includes('NAPOLETANO'));
    const romaCat = cats.find(c => c.nombre.toUpperCase().includes('ROMANA'));

    console.log(`NAPO Cat: ${napoCat?.id} - ${napoCat?.nombre}`);
    console.log(`ROMA Cat: ${romaCat?.id} - ${romaCat?.nombre}`);

    if (napoCat) {
        const { data: napoProds } = await supabase.from('productos').select('id, nombre').eq('categoria_id', napoCat.id);
        console.log(`\nNapo Products count: ${napoProds?.length}`);
        if (napoProds && napoProds.length > 0) {
            const pIds = napoProds.map(p => p.id);
            const { data: rels } = await supabase.from('producto_grupos_adicionales').select('producto_id, grupo_id').in('producto_id', pIds);
            console.log(`Groups attached to Napo products: ${rels?.length}`);
        }
    }

    if (romaCat) {
        const { data: romaProds } = await supabase.from('productos').select('id, nombre').eq('categoria_id', romaCat.id);
        console.log(`\nRoma Products count: ${romaProds?.length}`);
        Object.values(romaProds || []).forEach(p => console.log(` - ${p.nombre} (${p.id})`));
        if (romaProds && romaProds.length > 0) {
            const pIds = romaProds.map(p => p.id);
            const { data: rels } = await supabase.from('producto_grupos_adicionales').select('producto_id').in('producto_id', pIds);
            console.log(`Groups attached to Roma products: ${rels?.length}`);
        }
    }
}
check();
