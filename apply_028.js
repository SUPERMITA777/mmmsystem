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
        
        console.log("Applying 028_caja_improvements.sql...");
        const sqlPath = path.join(__dirname, 'supabase', 'migrations', '028_caja_improvements.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await client.query(sql);
        console.log("Migration 028 applied successfully!");

    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await client.end();
    }
}

run();
