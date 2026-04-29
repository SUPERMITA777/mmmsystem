const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres'
});

async function run() {
    await client.connect();

    // Check RLS policies on usuarios table
    console.log('\n=== POLICIES ON usuarios ===');
    const r1 = await client.query("SELECT policyname, cmd, roles, qual FROM pg_policies WHERE tablename = 'usuarios'");
    console.table(r1.rows);

    // Check if RLS is enabled
    console.log('\n=== RLS STATUS ===');
    const r2 = await client.query("SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'usuarios'");
    console.table(r2.rows);

    // Check the helper functions
    console.log('\n=== HELPER FUNCTIONS ===');
    const r3 = await client.query(`
        SELECT proname, prosecdef, prosrc 
        FROM pg_proc 
        WHERE proname IN ('get_user_sucursal_id', 'is_sucursal_admin', 'is_super_admin')
    `);
    r3.rows.forEach(row => {
        console.log(`\n--- ${row.proname} (SECURITY DEFINER: ${row.prosecdef}) ---`);
        console.log(row.prosrc.trim());
    });

    // Test: what would the RLS function return for the logged-in user?
    // Don Juan camarero1 = b7e95544-d0d3-4c18-9ab7-5427618e0699
    console.log('\n=== TEST: get_user_sucursal_id for camarero1 ===');
    try {
        const r4 = await client.query("SELECT get_user_sucursal_id('b7e95544-d0d3-4c18-9ab7-5427618e0699')");
        console.log('Result:', r4.rows[0]);
    } catch(e) {
        console.log('Error:', e.message);
    }

    await client.end();
}

run().catch(console.error);
