import pg from "pg";

const { Client } = pg;

// Use IPv6 directly since DNS is failing
const HOST = "2600:1f18:2e13:9d02:30ee:340b:e6ca:e33e";
const DB_PASSWORD = process.argv[2];

const client = new Client({
    host: HOST,
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
});

async function main() {
    console.log(`Intentando conectar a ${HOST}...`);
    try {
        await client.connect();
        console.log("Conectado a Supabase!");

        const sql = `
-- 1. Agregar columna adicionales si no existe
ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS adicionales JSONB DEFAULT '[]'::jsonb;

-- 2. Corregir función de numeración
CREATE OR REPLACE FUNCTION generate_pedido_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  year_part TEXT;
  sequence_num INTEGER;
BEGIN
  year_part := TO_CHAR(NOW(), 'YY');
  -- Usamos RIGHT(..., 6) para ignorar el prefijo PED-YY
  SELECT COALESCE(MAX(CAST(RIGHT(numero_pedido, 6) AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM pedidos
  WHERE numero_pedido LIKE 'PED-' || year_part || '%';
  new_number := 'PED-' || year_part || LPAD(sequence_num::TEXT, 6, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- 3. Corregir función del trigger
CREATE OR REPLACE FUNCTION set_pedido_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_pedido IS NULL OR NEW.numero_pedido = '' THEN
    NEW.numero_pedido := generate_pedido_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Limpiar datos conflictivos
DELETE FROM pedidos WHERE numero_pedido IN ('PED-26262626', 'PED-26262600', 'PED-26260000');
        `;

        await client.query(sql);
        console.log("ÉXITO: Base de datos reparada totalmente.");
        await client.end();
    } catch (e) {
        console.error("ERROR de conexión:", e.message);
        process.exit(1);
    }
}

main();
