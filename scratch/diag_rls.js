const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres'
});

async function run() {
    await client.connect();

    // 1. Check RLS policies on user_roles
    console.log('\n=== POLICIES ON user_roles ===');
    const r1 = await client.query("SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'user_roles'");
    console.table(r1.rows);

    // 2. Check RLS policies on usuarios
    console.log('\n=== POLICIES ON usuarios ===');
    const r2 = await client.query("SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'usuarios'");
    console.table(r2.rows);

    // 3. Check if RLS is enabled
    console.log('\n=== RLS ENABLED? ===');
    const r3 = await client.query("SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('user_roles', 'usuarios')");
    console.table(r3.rows);

    // 4. Check user_roles schema
    console.log('\n=== user_roles COLUMNS ===');
    const r4 = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_roles' ORDER BY ordinal_position");
    console.table(r4.rows);

    // 5. Check if my user exists in usuarios AND what sucursal
    console.log('\n=== MY USER IN usuarios ===');
    const r5 = await client.query("SELECT id, email, rol, sucursal_id FROM public.usuarios WHERE email ILIKE '%emanuel%' OR email ILIKE '%ema%'");
    console.table(r5.rows);

    // 6. Check my user in user_roles
    console.log('\n=== MY USER IN user_roles ===');
    const r6 = await client.query("SELECT * FROM user_roles WHERE role = 'superadmin'");
    console.table(r6.rows);

    // 7. Check auth.users for my email
    console.log('\n=== MY ACCOUNT IN auth.users ===');
    const r7 = await client.query("SELECT id, email, raw_user_meta_data FROM auth.users WHERE email ILIKE '%emanuel%' LIMIT 5");
    console.table(r7.rows);

    await client.end();
}

run().catch(console.error);
