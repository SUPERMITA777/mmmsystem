
const pg = require('pg');
const { Client } = pg;

const dbUrl = "postgres://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres";

const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        const res = await client.query(`
            SELECT id, sucursal_id, created_at, numero_pedido 
            FROM pedidos 
            ORDER BY created_at ASC 
            LIMIT 10;
        `);
        console.log("Oldest Orders:");
        console.table(res.rows);

        const res2 = await client.query(`SELECT id, nombre, slug FROM sucursales;`);
        console.log("\nAll Sucursales:");
        console.table(res2.rows);

    } catch (error) {
        console.error("Error:", error.message);
    } finally {
        await client.end();
    }
}

run();
