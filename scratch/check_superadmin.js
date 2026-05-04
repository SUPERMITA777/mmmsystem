
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSuperAdmin() {
    console.log('Checking for super_admin users...');
    const { data, error } = await supabaseAdmin
        .from('usuarios')
        .select('*')
        .eq('rol', 'super_admin');

    if (error) {
        console.error('Error fetching users:', error);
        return;
    }

    if (data.length === 0) {
        console.log('No super_admin users found in the "usuarios" table.');
    } else {
        console.log('Found super_admin users:');
        data.forEach(user => {
            console.log(`- ID: ${user.id}, Email: ${user.email || 'N/A'}, Rol: ${user.rol}`);
        });
    }

    // Also check auth.users if possible
    // Note: service role can list users
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) {
        console.error('Error fetching auth users:', authError);
    } else {
        console.log('\nAuth users in Supabase:');
        authUsers.users.forEach(user => {
            console.log(`- ID: ${user.id}, Email: ${user.email}`);
        });
    }
}

checkSuperAdmin();
