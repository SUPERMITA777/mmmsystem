/**
 * Aplica migración 003 directamente a Supabase via Management API
 * Usa SUPABASE_SECRET_KEY (Personal Access Token sb_secret_*)
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
    try {
        const content = readFileSync(join(__dirname, "..", ".env"), "utf-8");
        content.split("\n").forEach(line => {
            const t = line.trim().replace(/\r$/, "");
            if (!t || t.startsWith("#")) return;
            const idx = t.indexOf("=");
            if (idx < 0) return;
            process.env[t.slice(0, idx).trim()] ??= t.slice(idx + 1).trim();
        });
    } catch { }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const PROJECT_REF = SUPABASE_URL?.match(/https:\/\/([^.]+)\./)?.[1];

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
        );`,
    },
    {
        label: "Crear trigger updated_at en zonas_entrega",
        sql: `DO $$ BEGIN
            CREATE TRIGGER update_zonas_entrega_updated_at
                BEFORE UPDATE ON zonas_entrega
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    },
    {
        label: "Agregar local_lat a config_sucursal",
        sql: `ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS local_lat DOUBLE PRECISION DEFAULT NULL;`,
    },
    {
        label: "Agregar local_lng a config_sucursal",
        sql: `ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS local_lng DOUBLE PRECISION DEFAULT NULL;`,
    },
    {
        label: "Agregar local_direccion a config_sucursal",
        sql: `ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS local_direccion TEXT DEFAULT NULL;`,
    },
];

async function tryMgmtAPI(sql, token) {
    const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ query: sql }),
    });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = { error: text }; }
    if (!res.ok) throw new Error(json?.message || json?.error || `HTTP ${res.status}: ${text.slice(0, 200)}`);
    return json;
}

async function tryRestRpc(sql) {
    // Crear función exec_sql temporalmente si no existe, luego llamarla
    // Supabase REST RPC con service_role puede ejecutar funciones existentes
    const url = `${SUPABASE_URL}/rest/v1/rpc/exec_sql`;
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "apikey": SERVICE_KEY,
            "Authorization": `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ sql }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text.slice(0, 200));
    }
    return await res.json();
}

async function main() {
    console.log(`\n🔧 MMM System - Migración 003 → Supabase [${PROJECT_REF}]\n`);

    // Detectar método disponible
    console.log("🔍 Detectando método de conexión...");
    let method = null;

    // Intento 1: Management API con SECRET_KEY (Personal Access Token)
    try {
        const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}`, {
            headers: { "Authorization": `Bearer ${SECRET_KEY}` },
        });
        if (res.ok) { method = "mgmt-pat"; console.log("   ✅ Management API con SECRET_KEY funciona\n"); }
        else { console.log(`   ⚠  Management API SECRET_KEY: HTTP ${res.status}`); }
    } catch (e) { console.log(`   ⚠  Management API: ${e.message}`); }

    // Intento 2: RPC exec_sql via REST
    if (!method) {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` },
                body: JSON.stringify({ sql: "SELECT 1" }),
            });
            if (res.status !== 404) { method = "rpc"; console.log("   ✅ RPC exec_sql disponible\n"); }
            else { console.log("   ⚠  RPC exec_sql no existe aún"); }
        } catch (e) { console.log(`   ⚠  RPC: ${e.message}`); }
    }

    if (!method) {
        console.log("\n❌ No se encontró un método de conexión automático.");
        console.log("   Para que los scripts funcionen, agregar al .env:");
        console.log("   SUPABASE_DB_PASSWORD=<password de la BD>");
        console.log("   (Panel Supabase → Settings → Database → Connection string)\n");
        console.log("   O ejecutar manualmente en el SQL Editor de Supabase el archivo:");
        console.log("   supabase/migrations/003_zonas_entrega_y_local.sql\n");
        process.exit(1);
    }

    // Ejecutar pasos
    let ok = 0;
    for (const step of SQL_STEPS) {
        process.stdout.write(`  ⏳ ${step.label}... `);
        try {
            if (method === "mgmt-pat") await tryMgmtAPI(step.sql, SECRET_KEY);
            else await tryRestRpc(step.sql);
            console.log("✅");
            ok++;
        } catch (e) {
            // Si ya existe, no es un error real
            if (e.message.includes("already exists")) { console.log("✅ (ya existe)"); ok++; }
            else console.log(`❌  ${e.message.split("\n")[0]}`);
        }
    }

    console.log(`\n${ok === SQL_STEPS.length ? "✅ Migración completa." : `⚠  ${ok}/${SQL_STEPS.length} OK.`}`);
    if (ok > 0) console.log("ℹ️  Esperá ~30s y recargá la página para que PostgREST refresque.\n");
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
