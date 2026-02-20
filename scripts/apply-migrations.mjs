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
const DB_PASSWORD = process.argv[2];

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
    console.log("Conectado a Supabase...");

    const migrationPath = join(__dirname, "..", "supabase", "migrations", "002_additions_and_config.sql");
    const migrationSql = readFileSync(migrationPath, "utf-8");

    console.log("Aplicando migración 002...");
    // Split by semicollon or just run the whole block? 
    // Usually pg client handles one block. SQL block might have multiple statements.
    await client.query(migrationSql);
    console.log("Migración 002 aplicada con éxito.");

    // Recargar cache de PostgREST (esto se hace recreando el esquema o simplemente esperando)
    // En Supabase a veces hay que mandar un NOTIFY o usar el dashboard.
    // Pero el error PGRST204 suele ser porque la columna no existe físicamente.

    // De paso, eliminamos los pedidos de prueba que tienen números raros para limpiar el MAX(numero_pedido)
    console.log("Limpiando pedidos de prueba conflictivos...");
    await client.query("DELETE FROM pedidos WHERE numero_pedido IN ('PED-26262626', 'PED-26262600', 'PED-26260000')");
    console.log("Limpieza completada.");

    await client.end();
}

main().catch(async (e) => {
    console.error("Error:", e.message);
    await client.end().catch(() => { });
    process.exit(1);
});
