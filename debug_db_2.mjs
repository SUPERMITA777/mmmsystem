
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xnupjsxbvyirpeagbloe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhudXBqc3hidnlpcnBlYWdibG9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NDk4NjksImV4cCI6MjA4NjIyNTg2OX0.p5wMjlSnHvDncNKi__ki6RFMQZNxNackaL3NzcNllxA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("--- Global Stats ---");
  const { count: totalProds } = await supabase.from('productos').select('*', { count: 'exact', head: true });
  const { count: totalCats } = await supabase.from('categorias').select('*', { count: 'exact', head: true });
  console.log(`Total Productos en DB: ${totalProds}`);
  console.log(`Total Categorias en DB: ${totalCats}`);

  console.log("\n--- Scanning for Orphaned Products (no category) ---");
  const { data: orphans } = await supabase.from('productos').select('id, nombre, categoria_id, sucursal_id').is('categoria_id', null);
  console.log(`Orphaned Products (${orphans?.length || 0}):`, JSON.stringify(orphans, null, 2));

  console.log("\n--- Scanning for Inactive Categories ---");
  const { data: inactiveCats } = await supabase.from('categorias').select('id, nombre, activo, sucursal_id').eq('activo', false);
  console.log(`Inactive Categories (${inactiveCats?.length || 0}):`, JSON.stringify(inactiveCats, null, 2));

  console.log("\n--- Sample of Hidden Products ---");
  const { data: hiddenProds } = await supabase.from('productos').select('id, nombre, visible_en_menu, sucursal_id').eq('visible_en_menu', false).limit(10);
  console.log(`Hidden Products Sample:`, JSON.stringify(hiddenProds, null, 2));
}

run();
