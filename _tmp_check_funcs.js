const { Client } = require('pg');
const dbUrl = 'postgresql://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres';

const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        const funcRes = await client.query(`
            SELECT p.proname, u.usename as owner, p.prosecdef 
            FROM pg_proc p 
            JOIN pg_user u ON u.usesysid = p.proowner 
            WHERE p.proname IN ('get_user_sucursal_id', 'is_super_admin', 'is_sucursal_admin');
        `);
        console.table(funcRes.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
run();
