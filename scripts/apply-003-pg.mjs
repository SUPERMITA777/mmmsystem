import pkg from "pg";
const { Client } = pkg;
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
    try {
        const content = readFileSync(join(__dirname, "..", ".env"), "utf-8");
        for (const line of content.split("\n")) {
            const t = line.trim().replace(/\r$/, "");
            if (!t || t.startsWith("#")) continue;
            if (t.includes("=")) {
                const idx = t.indexOf("=");
                process.env[t.slice(0, idx).trim()] ??= t.slice(idx + 1).trim();
            } else {
                // Handle bare "Password VALUE" lines
                const m = t.match(/^password\s+(\S+)$/i);
                if (m) process.env.SUPABASE_DB_PASSWORD ??= m[1];
            }
        }
    } catch { }
}

loadEnv();

const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\./)?.[1];
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;

if (!PROJECT_REF || !DB_PASSWORD) {
    console.error("❌ Faltan credenciales. PROJECT_REF:", PROJECT_REF, " DB_PASSWORD:", !!DB_PASSWORD);
    process.exit(1);
}

// Supabase Transaction Pooler (port 5432) - supports DDL
const connectionString = `postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`;

const SQL_STEPS = [
    {
        label: "Crear tabla zonas_entrega",
        sql: `CREATE TABLE IF NOT EXISTS zonas_entrega (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
            nombre TEXT NOT NULL,
            costo_envio NUMERIC(12,2) DEFAULT 0,
            minimo_compra NUMERIC(12,2) DEFAULT 0,
            envio_gratis_desde NUMERIC(12,2) DEFAULT NULL,
            tiempo_estimado_minutos INTEGER DEFAULT NULL,
            tipo_precio TEXT DEFAULT 'fijo',
            precio_por_km NUMERIC(12,2) DEFAULT 0,
            polygon_coords JSONB DEFAULT NULL,
            activo BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )`,
    },
    {
        label: "Crear trigger updated_at en zonas_entrega",
        sql: `DO $$ BEGIN
            CREATE TRIGGER update_zonas_entrega_updated_at
                BEFORE UPDATE ON zonas_entrega
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    },
    { label: "local_lat  → config_sucursal", sql: `ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS local_lat DOUBLE PRECISION DEFAULT NULL` },
    { label: "local_lng  → config_sucursal", sql: `ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS local_lng DOUBLE PRECISION DEFAULT NULL` },
    { label: "local_direccion → config_sucursal", sql: `ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS local_direccion TEXT DEFAULT NULL` },
    { label: "Recargar caché de PostgREST", sql: `NOTIFY pgrst, 'reload schema'` },
];

async function main() {
    console.log(`\n🔧 Migración 003 → Supabase [${PROJECT_REF}]\n`);
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
        await client.connect();
        console.log("✅ Conectado a Supabase PostgreSQL\n");
    } catch (e) {
        // Try different regions
        const regions = ["us-west-1", "us-east-2", "eu-central-1", "ap-southeast-1"];
        let connected = false;
        for (const region of regions) {
            try {
                const cs = `postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-${region}.pooler.supabase.com:5432/postgres`;
                const c2 = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
                await c2.connect();
                console.log(`✅ Conectado via región ${region}\n`);
                await runSteps(c2);
                await c2.end();
                connected = true;
                break;
            } catch { }
        }
        if (!connected) {
            console.error("❌ No se pudo conectar en ninguna región. Verificá el password.");
            process.exit(1);
        }
        return;
    }
    await runSteps(client);
    await client.end();
}

async function runSteps(client) {
    let ok = 0;
    for (const step of SQL_STEPS) {
        process.stdout.write(`  ⏳ ${step.label}... `);
        try {
            await client.query(step.sql);
            console.log("✅");
            ok++;
        } catch (e) {
            if (e.message.includes("already exists")) { console.log("✅ (ya existe)"); ok++; }
            else console.log(`❌  ${e.message.split("\n")[0]}`);
        }
    }
    console.log(`\n${ok === SQL_STEPS.length ? "✅ Migración completa." : `⚠  ${ok}/${SQL_STEPS.length} OK.`}`);
    console.log("ℹ  PostgREST refresca el caché automáticamente en ~30s.\n");
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
