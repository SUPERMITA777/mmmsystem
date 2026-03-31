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
        
        console.log("Applying 019_analytics_hourly.sql...");
        const sql19Path = path.join(__dirname, 'supabase', 'migrations', '019_analytics_hourly.sql');
        const sql19 = fs.readFileSync(sql19Path, 'utf8');
        await client.query(sql19);
        console.log("Migration 019 applied successfully!");

    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await client.end();
    }
}

run();
