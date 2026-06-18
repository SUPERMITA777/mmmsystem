import pg from 'pg';

const { Client } = pg;
const dbUrl = "postgres://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres";

const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        const prodId = '67286787-51ea-4c75-a595-bb051a28e619';
        
        console.log(`=== Producto ${prodId} ===`);
        const prod = await client.query(`
            SELECT * FROM productos WHERE id = $1;
        `, [prodId]);
        console.log(JSON.stringify(prod.rows, null, 2));

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await client.end();
    }
}

run();
