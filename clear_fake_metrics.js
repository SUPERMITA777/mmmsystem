const { Client } = require('pg');

const dbUrl = 'postgresql://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres';

const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        
        console.log("Emptying analytics_visitas table...");
        await client.query('TRUNCATE TABLE analytics_visitas;');
        
        console.log("Resetting sucursales total & hourly visit counters to 0...");
        await client.query('UPDATE sucursales SET visitas_total = 0, visitas_hoy = 0;');

        console.log("All fake visit data wiped successfully!");
    } catch (error) {
        console.error("Failed to wipe metrics:", error);
    } finally {
        await client.end();
    }
}

run();
