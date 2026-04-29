const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres'
});

async function run() {
    await client.connect();

    // List ALL auth users to find the actual admin account
    console.log('\n=== ALL AUTH USERS ===');
    const r1 = await client.query("SELECT id, email, created_at FROM auth.users ORDER BY created_at ASC");
    console.table(r1.rows);

    // List ALL user_roles
    console.log('\n=== ALL user_roles ===');
    const r2 = await client.query("SELECT * FROM user_roles ORDER BY created_at ASC");
    console.table(r2.rows);

    // List ALL usuarios
    console.log('\n=== ALL public.usuarios (id, email, rol, sucursal_id) ===');
    const r3 = await client.query("SELECT id, email, rol, sucursal_id FROM public.usuarios ORDER BY created_at ASC");
    console.table(r3.rows);

    await client.end();
}

run().catch(console.error);
