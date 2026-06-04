const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const dbUrl = 'postgresql://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres';

const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        console.log("Connected to DB!");

        const sqlPath = path.join(__dirname, 'supabase', 'migrations', '033_add_terminal_id_to_pedidos.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log("Applying migration 033...");
        await client.query(sql);
        console.log("Migration applied successfully!");

    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await client.end();
    }
}

run();
