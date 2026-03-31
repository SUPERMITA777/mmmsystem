const { Client } = require('pg');

const dbUrl = 'postgresql://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres';

const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        // Get the first sucursal ID to test
        const sucursalRes = await client.query('SELECT id FROM sucursales LIMIT 1;');
        const s_id = sucursalRes.rows[0].id;
        console.log("Testing with sucursal ID:", s_id);

        // Call the RPC via SQL function directly
        const res = await client.query("SELECT increment_sucursal_visits($1)", [s_id]);
        console.log("RPC execution success", res.rows);
    } catch (e) {
        console.error("Error executing RPC:", e.message);
    } finally {
        await client.end();
    }
}
run();
