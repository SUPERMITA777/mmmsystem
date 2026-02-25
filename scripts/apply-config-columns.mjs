import pg from 'pg';

const { Client } = pg;

const dbUrl = "postgres://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres";

const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

const sql = `
-- Add missing columns to config_sucursal
ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS color_primario TEXT DEFAULT '#f97316';
ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS color_secundario TEXT DEFAULT '#1a1a2e';
ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS facebook_url TEXT;

-- Refresh PostgREST cache so it recognizes the new columns
NOTIFY pgrst, 'reload schema';
`;

async function run() {
    try {
        await client.connect();
        console.log("✅ Conectado a Supabase.");
        console.log("⏳ Agregando columnas faltantes a config_sucursal...");
        await client.query(sql);
        console.log("✅ ¡Columnas agregadas y schema recargado!");
    } catch (error) {
        console.error("❌ Error:", error.message);
    } finally {
        await client.end();
    }
}

run();
