const { Client } = require('pg');

const run = async () => {
    const connectionString = 'postgres://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres';
    const client = new Client({ connectionString });
    try {
        await client.connect();

        // Count products grouped by name to find duplicates
        const res = await client.query(`
            SELECT nombre, COUNT(*) as count 
            FROM productos 
            GROUP BY nombre 
            HAVING COUNT(*) > 1 
            ORDER BY count DESC
        `);
        console.log("Duplicate product names:");
        console.table(res.rows);
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
};

run();
