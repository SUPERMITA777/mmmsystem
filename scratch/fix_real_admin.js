const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres'
});

async function fix() {
    await client.connect();
    console.log('✅ Conectado.');

    const realUserId = '5c6f68b9-173c-4edc-a9ef-dec45829aa88'; // ema@mmm.com
    const donjuanId = '15cc8387-26f9-457c-b27e-f3029d1654f2';

    // 1. Fix: Update ema@mmm.com in public.usuarios to be super_admin + linked to Don Juan
    console.log('\n🔧 Actualizando public.usuarios: ema@mmm.com -> super_admin + Don Juan...');
    const r1 = await client.query(
        "UPDATE public.usuarios SET rol = 'super_admin', sucursal_id = $1 WHERE id = $2 RETURNING id, email, rol, sucursal_id",
        [donjuanId, realUserId]
    );
    console.table(r1.rows);

    // 2. Clean up the phantom user_roles entry (70ca573a doesn't exist in auth)
    console.log('\n🧹 Limpiando entrada fantasma en user_roles...');
    await client.query("DELETE FROM user_roles WHERE user_id = '70ca573a-23f2-45e6-9964-b633075c345f'");
    console.log('✅ Fantasma eliminado.');

    // 3. Verify the superadmin entry exists for the REAL user
    console.log('\n✅ Verificando que ema@mmm.com tiene superadmin en user_roles...');
    const r3 = await client.query("SELECT * FROM user_roles WHERE user_id = $1", [realUserId]);
    console.table(r3.rows);

    // 4. Verify final state
    console.log('\n📋 Estado final de public.usuarios para ema@mmm.com:');
    const r4 = await client.query("SELECT id, email, rol, sucursal_id FROM public.usuarios WHERE id = $1", [realUserId]);
    console.table(r4.rows);

    await client.end();
    console.log('\n🎉 ¡Todo corregido! Refresca el navegador.');
}

fix().catch(console.error);
