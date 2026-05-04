
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRolesTables() {
    console.log('--- Checking "usuarios" table ---');
    const { data: usuarios, error: uError } = await supabaseAdmin
        .from('usuarios')
        .select('*');
    if (uError) console.error('Error in usuarios:', uError.message);
    else console.log('Usuarios count:', usuarios.length);

    console.log('\n--- Checking "user_roles" table ---');
    const { data: userRoles, error: rError } = await supabaseAdmin
        .from('user_roles')
        .select('*');
    if (rError) console.error('Error in user_roles:', rError.message);
    else {
        console.log('User Roles count:', userRoles.length);
        userRoles.forEach(r => console.log(`- User: ${r.user_id}, Role: ${r.role}`));
    }
}

checkRolesTables();
