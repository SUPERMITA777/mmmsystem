import pg from 'pg';

const { Client } = pg;

// Connection string from your system
const dbUrl = "postgres://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres";

const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

const sql = `
-- 1. Asegurar que la columna adicionales existe en pedido_items
ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS adicionales JSONB DEFAULT '[]'::jsonb;

-- 2. Asegurar que las tablas de adicionales existan (por si acaso)
CREATE TABLE IF NOT EXISTS grupos_adicionales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    seleccion_obligatoria BOOLEAN DEFAULT FALSE,
    seleccion_minima INTEGER DEFAULT 0,
    seleccion_maxima INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS adicionales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grupo_id UUID REFERENCES grupos_adicionales(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    precio_venta NUMERIC(12,2) DEFAULT 0,
    precio_costo NUMERIC(12,2) DEFAULT 0,
    seleccion_maxima INTEGER DEFAULT 1,
    visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Limpiar caché de esquema para PostgREST (esto soluciona el error 400 si la columna es nueva)
NOTIFY pgrst, 'reload schema';
`;

async function run() {
    try {
        await client.connect();
        console.log("Conectado a Base de Datos de Supabase...");
        console.log("Ejecutando correcciones de esquema...");
        await client.query(sql);
        console.log("¡Hecho! Esquema actualizado y caché refrescado.");
    } catch (error) {
        console.error("Error ejecutando corrección:", error);
    } finally {
        await client.end();
    }
}

run();
