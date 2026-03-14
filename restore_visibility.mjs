
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xnupjsxbvyirpeagbloe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhudXBqc3hidnlpcnBlYWdibG9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NDk4NjksImV4cCI6MjA4NjIyNTg2OX0.p5wMjlSnHvDncNKi__ki6RFMQZNxNackaL3NzcNllxA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Restoring product visibility for all products...");
  // Use a query that matches all products without invalid UUIDs
  const { data, error } = await supabase
    .from('productos')
    .update({ visible_en_menu: true, producto_oculto: false })
    .not('id', 'is', null)
    .select('id, nombre');

  if (error) {
    console.error("Error restoring visibility:", error);
  } else {
    console.log(`Restored ${data?.length || 0} products:`, JSON.stringify(data, null, 2));
  }
}

run();
