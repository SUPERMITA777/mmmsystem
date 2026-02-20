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

if (!DB_PASSWORD) {
    console.error("Uso: node scripts/fix-pedido-function.mjs TU_PASSWORD");
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
    console.log("Conectado a Supabase...");

    const sql = `
CREATE OR REPLACE FUNCTION generate_pedido_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  year_part TEXT;
  sequence_num INTEGER;
BEGIN
  year_part := TO_CHAR(NOW(), 'YY');
  
  -- Obtener el siguiente número de secuencia para el año (solo los últimos 6 dígitos)
  SELECT COALESCE(MAX(CAST(RIGHT(numero_pedido, 6) AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM pedidos
  WHERE numero_pedido LIKE 'PED-' || year_part || '%';
  
  new_number := 'PED-' || year_part || LPAD(sequence_num::TEXT, 6, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_pedido_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_pedido IS NULL OR NEW.numero_pedido = '' THEN
    NEW.numero_pedido := generate_pedido_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
    `;

    await client.query(sql);
    console.log("Funciones generate_pedido_number y set_pedido_number actualizadas correctamente.");

    await client.end();
}

main().catch(async (e) => {
    console.error("Error:", e.message);
    await client.end().catch(() => { });
    process.exit(1);
});
