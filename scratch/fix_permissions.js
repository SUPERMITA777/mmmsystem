const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres'
});

async function fix() {
    await client.connect();
    console.log('✅ Conectado.');

    // Grant SELECT on user_roles to authenticated users (needed for the frontend superadmin page)
    console.log('\n🔧 Otorgando permisos SELECT en user_roles a authenticated...');
    await client.query("GRANT SELECT ON user_roles TO authenticated;");
    console.log('✅ Permisos otorgados.');

    // Also grant to anon just in case
    console.log('🔧 Otorgando permisos SELECT en user_roles a anon...');
    await client.query("GRANT SELECT ON user_roles TO anon;");
    console.log('✅ Permisos otorgados.');

    // Verify
    console.log('\n📋 Verificando permisos en user_roles...');
    const r = await client.query(`
        SELECT grantee, privilege_type 
        FROM information_schema.role_table_grants 
        WHERE table_name = 'user_roles'
    `);
    console.table(r.rows);

    await client.end();
}

fix().catch(console.error);
