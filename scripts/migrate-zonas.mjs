/**
 * Aplica migración para soporte de polígonos en zonas_entrega
 * Agrega polygon_coords, local_lat, local_lng, tipo_precio, precio_por_km
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

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

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
);

async function addColumnIfNotExists(table, column, type, defaultVal) {
    const { error } = await supabase
        .from(table)
        .select(column)
        .limit(1);
    if (error?.code === "PGRST204") {
        console.log(`❌ Columna '${column}' no existe en '${table}' — necesita ALTER TABLE`);
        return false;
    }
    console.log(`✅ Columna '${column}' ya existe en '${table}'`);
    return true;
}

async function main() {
    console.log("\n🗺️  Verificando soporte de polígonos en zonas_entrega...\n");

    await addColumnIfNotExists("zonas_entrega", "polygon_coords", "JSONB", null);
    await addColumnIfNotExists("zonas_entrega", "tipo_precio", "TEXT", "fijo");
    await addColumnIfNotExists("zonas_entrega", "precio_por_km", "NUMERIC", "0");

    // Verificar config_sucursal para coords del local
    await addColumnIfNotExists("config_sucursal", "local_lat", "FLOAT", null);
    await addColumnIfNotExists("config_sucursal", "local_lng", "FLOAT", null);

    console.log("\n📋 SQL para ejecutar en Supabase SQL Editor:\n");
    console.log(`-- Zonas de entrega
ALTER TABLE zonas_entrega ADD COLUMN IF NOT EXISTS polygon_coords JSONB DEFAULT NULL;
ALTER TABLE zonas_entrega ADD COLUMN IF NOT EXISTS tipo_precio TEXT DEFAULT 'fijo';
ALTER TABLE zonas_entrega ADD COLUMN IF NOT EXISTS precio_por_km NUMERIC(12,2) DEFAULT 0;

-- Config sucursal (ubicación del local)
ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS local_lat FLOAT DEFAULT NULL;
ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS local_lng FLOAT DEFAULT NULL;
ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS local_direccion TEXT DEFAULT NULL;
`);
}

main().catch(e => {
    console.error("Error:", e.message);
    process.exit(1);
});
