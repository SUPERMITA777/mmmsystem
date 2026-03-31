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
        
        console.log("Applying 018_temporal_analytics.sql...");
        const sql18Path = path.join(__dirname, 'supabase', 'migrations', '018_temporal_analytics.sql');
        const sql18 = fs.readFileSync(sql18Path, 'utf8');
        await client.query(sql18);
        console.log("Migration 018 applied successfully!");

    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await client.end();
    }
}

run();
