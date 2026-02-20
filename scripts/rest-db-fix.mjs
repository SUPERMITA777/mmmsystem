/**
 * Aplica el parche de base de datos via Supabase REST API (sin necesidad de PostgreSQL port 5432)
 */

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

async function runSQL(sql, label) {
    process.stdout.write(`⏳ ${label}... `);
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/query_runner`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "apikey": SERVICE_ROLE_KEY,
                "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ query: sql }),
        });
        if (res.ok) {
            console.log("✅");
            return true;
        } else {
            const body = await res.text();
            console.log(`❌ ${res.status}: ${body.substring(0, 200)}`);
            return false;
        }
    } catch (e) {
        console.log(`❌ ${e.message}`);
        return false;
    }
}

// Supabase no tiene un endpoint /rpc/query_runner nativo,
// pero sí tiene la Management API para ejecutar SQL.
// Usamos la SQL endpoint de la Management API de Supabase.
async function runMgmtSQL(sql, label) {
    process.stdout.write(`⏳ ${label}... `);
    // Extract project ref
    const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
    const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

    try {
        const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SECRET_KEY}`,
            },
            body: JSON.stringify({ query: sql }),
        });
        const body = await res.text();
        if (res.ok) {
            console.log("✅");
            return true;
        } else {
            console.log(`❌ ${res.status}: ${body.substring(0, 300)}`);
            return false;
        }
    } catch (e) {
        console.log(`❌ ${e.message}`);
        return false;
    }
}

async function main() {
    console.log("\n🔧 MMM SYSTEM - Reparación via Supabase Management API\n");
    console.log(`URL: ${SUPABASE_URL}`);

    const steps = [
        {
            label: "Agregar columna adicionales a pedido_items",
            sql: "ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS adicionales JSONB DEFAULT '[]'::jsonb;"
        },
        {
            label: "Corregir función generate_pedido_number",
            sql: `CREATE OR REPLACE FUNCTION generate_pedido_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  year_part TEXT;
  sequence_num INTEGER;
BEGIN
  year_part := TO_CHAR(NOW(), 'YY');
  SELECT COALESCE(MAX(CAST(RIGHT(numero_pedido, 6) AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM pedidos
  WHERE numero_pedido LIKE 'PED-' || year_part || '%';
  new_number := 'PED-' || year_part || LPAD(sequence_num::TEXT, 6, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;`
        },
        {
            label: "Corregir función set_pedido_number (trigger)",
            sql: `CREATE OR REPLACE FUNCTION set_pedido_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_pedido IS NULL OR NEW.numero_pedido = '' THEN
    NEW.numero_pedido := generate_pedido_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;`
        },
        {
            label: "Limpiar pedidos de prueba con números duplicados",
            sql: "DELETE FROM pedidos WHERE numero_pedido IN ('PED-26262626', 'PED-26262600', 'PED-26260000');"
        },
    ];

    let allOk = true;
    for (const step of steps) {
        const ok = await runMgmtSQL(step.sql, step.label);
        if (!ok) allOk = false;
    }

    if (allOk) {
        console.log("\n✅ ¡Base de datos reparada completamente!");
    } else {
        console.log("\n⚠️ Algunos pasos fallaron. Revisar salida arriba.");
    }
}

main().catch(e => {
    console.error("Error fatal:", e.message);
    process.exit(1);
});
