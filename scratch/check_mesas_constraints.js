
const { createClient } = require('@supabase/supabase-client');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkConstraints() {
  const { data, error } = await supabase.rpc('get_table_constraints', { t_name: 'mesas' });
  if (error) {
    // If RPC doesn't exist, try a raw query via a temporary function if allowed, 
    // or just assume the (sucursal_id, numero) unique constraint exists as it's common.
    console.log('Error fetching constraints:', error);
    
    // Alternative: try to insert two rows with same numero
    console.log('Testing (sucursal_id, numero) uniqueness...');
    const testId = '15cc8387-26f9-457c-b27e-f3029d1654f2';
    const { error: err1 } = await supabase.from('mesas').insert({ sucursal_id: testId, numero: 9999, nombre: 'Test1' });
    const { error: err2 } = await supabase.from('mesas').insert({ sucursal_id: testId, numero: 9999, nombre: 'Test2' });
    
    if (err2) {
      console.log('Constraint confirmed:', err2.message);
    } else {
      console.log('No constraint found or error in test.');
    }
  } else {
    console.log('Constraints:', data);
  }
}

checkConstraints();
