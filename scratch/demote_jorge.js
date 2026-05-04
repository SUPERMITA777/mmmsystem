
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function demoteJorge() {
    const email = 'jorge@donjuan.com';
    console.log(`Cambiando rol de ${email} a administrador de tienda...`);

    // 1. Obtener ID del usuario
    const { data: userData, error: fetchError } = await supabaseAdmin
        .from('usuarios')
        .select('id')
        .eq('email', email)
        .single();

    if (fetchError || !userData) {
        console.error('No se encontró al usuario Jorge:', fetchError?.message);
        return;
    }

    const userId = userData.id;

    // 2. Actualizar en tabla "usuarios"
    const { error: uError } = await supabaseAdmin
        .from('usuarios')
        .update({ rol: 'admin' })
        .eq('id', userId);

    if (uError) console.error('Error en tabla "usuarios":', uError.message);
    else console.log('Actualizado en tabla "usuarios" (rol: admin).');

    // 3. Actualizar en tabla "user_roles"
    const { error: rError } = await supabaseAdmin
        .from('user_roles')
        .update({ role: 'admin' })
        .eq('user_id', userId);

    if (rError) console.error('Error en tabla "user_roles":', rError.message);
    else console.log('Actualizado en tabla "user_roles" (role: admin).');

    console.log('Proceso finalizado.');
}

demoteJorge();
