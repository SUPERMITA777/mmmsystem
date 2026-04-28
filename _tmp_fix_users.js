const { Client } = require('pg');
const dbUrl = 'postgresql://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres';

const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        
        // Find IRUYA's ID
        const sucursalRes = await client.query(`SELECT id, slug FROM sucursales WHERE slug = 'iruya'`);
        const iruyaId = sucursalRes.rows[0]?.id;

        if (iruyaId) {
            // Fix ivan@iruya
            await client.query(`UPDATE usuarios SET sucursal_id = $1 WHERE email = 'ivan@iruya'`, [iruyaId]);
            console.log("Fixed ivan@iruya to point to IRUYA tenant: " + iruyaId);
        } else {
            console.log("Could not find IRUYA sucursal.");
        }

        // For any other users like melli@donjuan.com that don't belong to mmm, set to null or fix them if donjuan exists
        const djRes = await client.query(`SELECT id FROM sucursales WHERE slug LIKE '%donjuan%'`);
        const djId = djRes.rows[0]?.id;
        if (djId) {
            await client.query(`UPDATE usuarios SET sucursal_id = $1 WHERE email = 'melli@donjuan.com'`, [djId]);
            console.log("Fixed melli@donjuan.com to point to DON JUAN tenant.");
        } else {
            await client.query(`UPDATE usuarios SET sucursal_id = NULL WHERE email = 'melli@donjuan.com'`);
            console.log("Set melli@donjuan.com to NULL sucursal_id.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
run();
