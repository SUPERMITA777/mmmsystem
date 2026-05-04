
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function syncCheck() {
    const { data: usuarios, error: uError } = await supabaseAdmin
        .from('usuarios')
        .select('*');

    const { data: { users }, error: aError } = await supabaseAdmin.auth.admin.listUsers();

    if (uError || aError) {
        console.error('Error:', uError || aError);
        return;
    }

    const authIds = new Set(users.map(u => u.id));
    const usuariosIds = new Set(usuarios.map(u => u.id));

    console.log('--- Usuarios in table but NOT in Auth ---');
    usuarios.forEach(u => {
        if (!authIds.has(u.id)) {
            console.log(`- ID: ${u.id}, Rol: ${u.rol}, Sucursal: ${u.sucursal_id}`);
        }
    });

    console.log('\n--- Users in Auth but NOT in Usuarios table ---');
    users.forEach(u => {
        if (!usuariosIds.has(u.id)) {
            console.log(`- ID: ${u.id}, Email: ${u.email}`);
        }
    });
}

syncCheck();
