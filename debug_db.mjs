
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xnupjsxbvyirpeagbloe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhudXBqc3hidnlpcnBlYWdibG9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NDk4NjksImV4cCI6MjA4NjIyNTg2OX0.p5wMjlSnHvDncNKi__ki6RFMQZNxNackaL3NzcNllxA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("--- Sucursales ---");
  const { data: sucs, error: e1 } = await supabase.from('sucursales').select('id, nombre, slug, activo');
  if (e1) console.error("Error sucs:", e1);
  console.log(JSON.stringify(sucs, null, 2));

  if (sucs) {
    for (const s of sucs) {
      console.log(`\n--- Checking Sucursal: ${s.slug} (${s.id}) ---`);
      
      const { data: cats, error: e2 } = await supabase.from('categorias').select('id, nombre, activo').eq('sucursal_id', s.id);
      if (e2) console.error("Error cats:", e2);
      console.log(`Categorias (${cats?.length || 0}):`, JSON.stringify(cats, null, 2));

      const { count: prodCount, error: e3 } = await supabase.from('productos').select('*', { count: 'exact', head: true }).eq('sucursal_id', s.id);
      if (e3) console.error("Error prods count:", e3);
      console.log(`Total Productos: ${prodCount}`);

      const { data: activeProds, error: e4 } = await supabase.from('productos').select('id, nombre, activo, categoria_id, visible_en_menu, producto_oculto').eq('sucursal_id', s.id).eq('activo', true).limit(5);
      if (e4) console.error("Error active prods:", e4);
      console.log(`Active Productos (sample):`, JSON.stringify(activeProds, null, 2));
    }
  }
}

run();
