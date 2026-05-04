
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createSuperAdmin(email, password) {
    console.log(`Intentando crear/restaurar SuperAdmin: ${email}`);

    // 1. Verificar si el usuario ya existe en Auth
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    let user = users.find(u => u.email === email);
    let userId;

    if (user) {
        userId = user.id;
        console.log(`El usuario ya existe en Auth con ID: ${userId}. Actualizando contraseña...`);
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
        if (updateError) {
            console.error('Error al actualizar contraseña:', updateError.message);
            return;
        }
    } else {
        // Crear nuevo usuario
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });

        if (authError) {
            console.error('Error al crear usuario en Auth:', authError.message);
            return;
        }
        userId = authUser.user.id;
        console.log(`Usuario creado en Auth con ID: ${userId}`);
    }

    // 2. Asegurar entrada en la tabla "usuarios" (rol: super_admin para el middleware)
    console.log('Sincronizando en tabla "usuarios"...');
    const { data: existingU } = await supabaseAdmin.from('usuarios').select('id').eq('id', userId).maybeSingle();
    
    const uPayload = { 
        id: userId, 
        email: email, 
        nombre: 'Super',
        apellido: 'Admin',
        rol: 'super_admin',
        sucursal_id: null,
        activo: true
    };

    if (existingU) {
        const { error: uError } = await supabaseAdmin.from('usuarios').update(uPayload).eq('id', userId);
        if (uError) console.error('Error al actualizar usuarios:', uError.message);
        else console.log('Usuario actualizado en tabla "usuarios".');
    } else {
        const { error: uError } = await supabaseAdmin.from('usuarios').insert([uPayload]);
        if (uError) console.error('Error al insertar en usuarios:', uError.message);
        else console.log('Usuario insertado en tabla "usuarios".');
    }

    // 3. Asegurar entrada en la tabla "user_roles" (role: superadmin para el panel)
    console.log('Sincronizando en tabla "user_roles"...');
    const { data: existingR } = await supabaseAdmin.from('user_roles').select('id').eq('user_id', userId).maybeSingle();
    
    const rPayload = { 
        user_id: userId, 
        role: 'superadmin',
        sucursal_id: null
    };

    if (existingR) {
        const { error: rError } = await supabaseAdmin.from('user_roles').update(rPayload).eq('user_id', userId);
        if (rError) console.error('Error al actualizar user_roles:', rError.message);
        else console.log('Rol actualizado en tabla "user_roles".');
    } else {
        const { error: rError } = await supabaseAdmin.from('user_roles').insert([rPayload]);
        if (rError) console.error('Error al insertar en user_roles:', rError.message);
        else console.log('Rol insertado en tabla "user_roles".');
    }

    console.log('\n--- PROCESO COMPLETADO ---');
    console.log(`Ya puedes ingresar con:`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
}

const email = 'ema@superadmin.com';
const password = '06021977';

createSuperAdmin(email, password);
