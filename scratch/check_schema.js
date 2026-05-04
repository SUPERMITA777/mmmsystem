
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
    // We can use RPC to get table info if available, or just try to fetch one row and see properties
    console.log('Checking "usuarios" columns...');
    const { data: uData, error: uError } = await supabaseAdmin.from('usuarios').select('*').limit(1);
    if (uData && uData.length > 0) {
        console.log('Columns in usuarios:', Object.keys(uData[0]));
    } else {
        console.log('No rows in usuarios or error:', uError?.message);
    }

    console.log('\nChecking "user_roles" columns...');
    const { data: rData, error: rError } = await supabaseAdmin.from('user_roles').select('*').limit(1);
    if (rData && rData.length > 0) {
        console.log('Columns in user_roles:', Object.keys(rData[0]));
    } else {
        console.log('No rows in user_roles or error:', rError?.message);
    }
}

checkSchema();
