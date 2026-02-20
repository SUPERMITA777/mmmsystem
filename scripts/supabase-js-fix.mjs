/**
 * Aplica el parche de DB usando Supabase JS client con service_role_key
 * El service_role_key bypassa RLS y puede usar funciones como rpc()
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
});

async function step(label, fn) {
    process.stdout.write(`⏳ ${label}... `);
    try {
        const result = await fn();
        if (result.error) throw result.error;
        console.log("✅");
        return true;
    } catch (e) {
        console.log(`❌ ${e.message?.split("\n")[0]}`);
        return false;
    }
}

async function main() {
    console.log("\n🔧 MMM SYSTEM - Reparación via Supabase JS Client\n");

    // Test connection
    const { data: test, error: testErr } = await supabase.from("pedidos").select("count").limit(1);
    if (testErr) {
        console.error("❌ Error de conexión:", testErr.message);
        process.exit(1);
    }
    console.log("✅ Conexión exitosa con service_role_key\n");

    // Para ejecutar DDL/DML arbitrario, necesitamos una función en la BD o usar rpc
    // Usamos rpc con exec_sql si existe, de lo contrario usamos un approach diferente.

    // Approach: Insert/Update via SDK no puede hacer ALTER TABLE.
    // Necesitamos verificar si la columna ya existe primero.
    const { data: cols } = await supabase
        .rpc("has_column", { tbl: "pedido_items", col: "adicionales" })
        .maybeSingle();

    console.log("Checking schema via RPC...", cols);

    // Probar si existe la columna polygon_coords en zonas_entrega
    const { data: testZonas, error: errZonas } = await supabase
        .from("zonas_entrega")
        .select("polygon_coords")
        .limit(1);

    if (errZonas?.code === "PGRST204") {
        console.log("❌ Columna 'polygon_coords' en 'zonas_entrega' NO es reconocida (PGRST204).");
    } else if (errZonas) {
        console.log("❌ Error consultando 'zonas_entrega':", errZonas.message);
    } else {
        console.log("✅ Columna 'polygon_coords' en 'zonas_entrega' EXISTE y ES RECONOCIDA.");
    }
}

main().catch(e => {
    console.error("Error fatal:", e.message);
    process.exit(1);
});
