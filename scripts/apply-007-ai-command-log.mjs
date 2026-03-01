import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { Client } = pg;

const dbUrl = "postgres://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres";

const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        console.log("✅ Conectado a Supabase.");
        console.log("⏳ Creando tabla ai_command_log...");

        const sql = readFileSync(resolve(__dirname, '..', 'supabase', 'migrations', '007_ai_command_log.sql'), 'utf8');
        await client.query(sql);

        // Reload PostgREST schema cache
        await client.query("NOTIFY pgrst, 'reload schema'");

        console.log("✅ ¡Tabla ai_command_log creada y schema recargado!");
    } catch (error) {
        console.error("❌ Error:", error.message);
    } finally {
        await client.end();
    }
}

run();
