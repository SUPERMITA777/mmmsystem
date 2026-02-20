import pg from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
    try {
        const envPath = join(__dirname, "..", ".env");
        const content = readFileSync(envPath, "utf-8");
        content.split("\n").forEach((line) => {
            const trimmed = line.trim().replace(/\r$/, "");
            if (!trimmed || trimmed.startsWith("#")) return;
            // Handle Password SoleyEma2711 line
            if (trimmed.toLowerCase().startsWith("password ")) {
                process.env.SUPABASE_DB_PASSWORD = trimmed.substring(9).trim();
                return;
            }
            const eqIdx = trimmed.indexOf("=");
            if (eqIdx < 0) return;
            const key = trimmed.slice(0, eqIdx).trim();
            const value = trimmed.slice(eqIdx + 1).trim();
            if (!process.env[key]) process.env[key] = value;
        });
    } catch (e) { }
}

loadEnv();

const PROJECT_REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const DB_PASSWORD = process.argv[2] || process.env.SUPABASE_DB_PASSWORD;

if (!PROJECT_REF || !DB_PASSWORD) {
    console.error("Missing credentials:", { PROJECT_REF, DB_PASSWORD: !!DB_PASSWORD });
    process.exit(1);
}

const client = new Client({
    host: `db.${PROJECT_REF}.supabase.co`,
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
});

async function main() {
    await client.connect();
    console.log("Conectado a la base de datos Supabase...");

    const sql = `
        ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_lat DOUBLE PRECISION DEFAULT NULL;
        ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_lng DOUBLE PRECISION DEFAULT NULL;
        NOTIFY pgrst, 'reload schema';
    `;

    console.log("Ejecutando ALTER TABLE para agregar cliente_lat y cliente_lng...");
    await client.query(sql);
    console.log("Columnas agregadas y caché recargada exitosamente.");

    await client.end();
}

main().catch(async (e) => {
    console.error("Error:", e.message);
    await client.end().catch(() => { });
    process.exit(1);
});
