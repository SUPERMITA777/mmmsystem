
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
            SELECT DISTINCT sucursal_id, count(*) FROM productos GROUP BY sucursal_id;
        `);
        console.log("Products per Sucursal:");
        console.table(res.rows);

        const res2 = await client.query(`
            SELECT DISTINCT sucursal_id, count(*) FROM pedidos GROUP BY sucursal_id;
        `);
        console.log("\nOrders per Sucursal:");
        console.table(res2.rows);

        const res3 = await client.query(`SELECT id, nombre, slug FROM sucursales;`);
        console.log("\nAll Sucursales:");
        console.table(res3.rows);

    } catch (error) {
        console.error("Error:", error.message);
    } finally {
        await client.end();
    }
}

run();
