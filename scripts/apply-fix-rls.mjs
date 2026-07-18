import pg from 'pg';

const { Client } = pg;

const dbUrl = "postgres://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres";

const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

const sql = `
-- Allow public select on pedidos (needed for client order tracking and select returning inserts)
DROP POLICY IF EXISTS "pedidos_public_select" ON pedidos;
CREATE POLICY "pedidos_public_select" ON pedidos
  FOR SELECT
  USING (TRUE);

-- Allow public update on clientes (needed when returning customers place a new order)
DROP POLICY IF EXISTS "clientes_public_update" ON clientes;
CREATE POLICY "clientes_public_update" ON clientes
  FOR UPDATE
  USING (TRUE)
  WITH CHECK (TRUE);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
`;

async function run() {
    try {
        await client.connect();
        console.log("✅ Conectado a Supabase Postgres...");
        console.log("🔄 Ejecutando migración: permitir SELECT público en pedidos y UPDATE público en clientes...");
        await client.query(sql);
        console.log("✅ ¡Migración exitosa!");
    } catch (error) {
        console.error("❌ Error:", error.message);
    } finally {
        await client.end();
    }
}

run();
