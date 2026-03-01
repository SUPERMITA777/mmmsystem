import pg from 'pg';

const { Client } = pg;

const dbUrl = "postgres://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres";

const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

const sql = `
ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS localidades JSONB DEFAULT '[]'::jsonb;
NOTIFY pgrst, 'reload schema';
`;

async function run() {
    try {
        await client.connect();
        console.log("✅ Conectado a Supabase Postgres...");
        console.log("🔄 Ejecutando migración: agregar columna localidades...");
        await client.query(sql);
        console.log("✅ ¡Migración exitosa! Columna 'localidades' agregada a config_sucursal.");
    } catch (error) {
        console.error("❌ Error:", error.message);
    } finally {
        await client.end();
    }
}

run();
