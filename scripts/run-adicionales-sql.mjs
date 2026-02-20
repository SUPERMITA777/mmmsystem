import pg from 'pg';

const { Client } = pg;

// Use direct URL from Supabase 
const dbUrl = "postgres://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres";

const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

const sql = `
-- 1. Grupos de Adicionales (El contenedor lógico, ej. "Elegí tus salsas", "Agregados extras")
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

-- 2. Adicionales (Las opciones individuales dentro de un grupo, ej. "Cheddar", "Papas")
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

-- 3. Pivot: Productos <-> Grupos (Para reutilizar grupos en múltiples productos)
CREATE TABLE IF NOT EXISTS producto_grupos_adicionales (
    producto_id UUID REFERENCES productos(id) ON DELETE CASCADE,
    grupo_id UUID REFERENCES grupos_adicionales(id) ON DELETE CASCADE,
    PRIMARY KEY (producto_id, grupo_id)
);

-- Refrescar caché de PostgREST
NOTIFY pgrst, 'reload schema';
`;

async function run() {
    try {
        await client.connect();
        console.log("Conectado a Supabase exitosamente (Directamente).");
        console.log("Ejecutando SQL para la migración de Adicionales...");
        await client.query(sql);
        console.log("¡Migración ejecutada con éxito!");
    } catch (error) {
        console.error("Error al ejecutar la migración:", error);
    } finally {
        await client.end();
    }
}

run();
