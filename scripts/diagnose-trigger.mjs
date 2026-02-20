/**
 * Crea una función exec_sql en Supabase para ejecutar DDL arbitrario,
 * luego la usa para corregir el trigger de numeración de pedidos.
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

// Intenta crear una función exec_sql temporal y usarla para corregir el trigger
async function tryWithRpc() {
    console.log("⏳ Intentando crear función auxiliar exec_sql...");

    // Primero verificamos si ya existe una función "exec_sql" o similar
    const { data, error } = await supabase.rpc("exec_sql", {
        sql: "SELECT 1 as test"
    });

    if (error?.code === "42883") {
        // Función no existe
        console.log("❌ Función exec_sql no disponible.");
        return false;
    }

    if (!error) {
        console.log("✅ exec_sql disponible!");
        return true;
    }

    console.log("Error:", error.message);
    return false;
}

// Usamos pg_notify para ver si podemos enviar el SQL via el canal de admin
async function tryAlterViaInsert() {
    console.log("\n⏳ Verificando el estado actual del trigger set_pedido_number...");

    // Insertamos un pedido de prueba para ver qué número genera
    const { data: suc } = await supabase.from("sucursales").select("id").limit(1).single();
    if (!suc) { console.log("❌ No se encontró sucursal."); return; }

    const { data: testPedido, error: testErr } = await supabase
        .from("pedidos")
        .insert([{
            sucursal_id: suc.id,
            numero_pedido: "",
            tipo: "takeaway",
            estado: "pendiente",
            origen: "test",
            subtotal: 0,
            costo_envio: 0,
            propina: 0,
            total: 0,
        }])
        .select()
        .single();

    if (testErr) {
        console.log("❌ Error al insertar pedido de prueba:", testErr.message);
        return;
    }

    console.log(`✅ Pedido de prueba insertado: ${testPedido.numero_pedido}`);

    // Eliminar el pedido de prueba
    await supabase.from("pedidos").delete().eq("id", testPedido.id);
    console.log("✅ Pedido de prueba eliminado.");

    return testPedido.numero_pedido;
}

async function main() {
    console.log("\n🔧 MMM SYSTEM - Diagnóstico del trigger de numeración\n");

    // Probar si el RPC exec_sql existe
    await tryWithRpc();

    // Probar qué genera el trigger actual
    const generatedNum = await tryAlterViaInsert();

    if (generatedNum) {
        const year = new Date().getFullYear().toString().slice(-2); // "26"
        const prefix = `PED-${year}`;

        if (generatedNum.startsWith(`${prefix}${year}`)) {
            console.log(`\n⚠️ Bug CONFIRMADO: El trigger sigue generando "${generatedNum}"`);
            console.log("El issue es que el trigger tiene PED-YY seguido del MAX que incluye el prefijo PED-YY.");
            console.log("El RIGHT(..., 6) debería funcionar. Revisando lógica...");
        } else if (generatedNum.length <= 12) {
            console.log(`\n✅ Trigger parece correcto. Generó: "${generatedNum}"`);
        } else {
            console.log(`\n⚠️ Número generado inusual: "${generatedNum}" (length: ${generatedNum.length})`);
        }
    }

    // Mostrar estado actual de la BD
    const { data: pedidos } = await supabase
        .from("pedidos")
        .select("numero_pedido, estado, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

    console.log("\n📊 Pedidos actuales:");
    console.table(pedidos);
}

main().catch(e => {
    console.error("Error fatal:", e.message);
    process.exit(1);
});
