const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkSchema() {
    console.log('Checking pedidos table...');
    const { data, error } = await supabase
        .from('pedidos')
        .select('camarero_id')
        .limit(1);
    
    if (error) {
        console.error('Error checking pedidos:', error.message);
    } else {
        console.log('camarero_id exists in pedidos');
    }

    console.log('Checking usuarios table...');
    const { data: uData, error: uError } = await supabase
        .from('usuarios')
        .select('color')
        .limit(1);
    
    if (uError) {
        console.error('Error checking usuarios:', uError.message);
    } else {
        console.log('color exists in usuarios');
    }
}

checkSchema();
