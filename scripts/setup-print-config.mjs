import pg from 'pg';

const { Client } = pg;

// Connection string from your system
const dbUrl = "postgres://postgres:SoleyEma2711@db.xnupjsxbvyirpeagbloe.supabase.co:5432/postgres";

const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

const sql = `
-- 1. Crear tabla de configuración de impresión si no existe
CREATE TABLE IF NOT EXISTS config_impresion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
    fuente_titulo INTEGER DEFAULT 22,
    fuente_subtitulo INTEGER DEFAULT 15,
    fuente_cliente_nombre INTEGER DEFAULT 19,
    fuente_cliente_detalles INTEGER DEFAULT 13,
    fuente_direccion INTEGER DEFAULT 14,
    fuente_items INTEGER DEFAULT 15,
    fuente_totales INTEGER DEFAULT 14,
    fuente_total_bold INTEGER DEFAULT 18,
    fuente_footer INTEGER DEFAULT 12,
    mostrar_telefono BOOLEAN DEFAULT TRUE,
    mostrar_direccion BOOLEAN DEFAULT TRUE,
    mostrar_fecha_hora BOOLEAN DEFAULT TRUE,
    color_accents TEXT DEFAULT '#2563eb',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sucursal_id)
);

-- 2. Insertar configuración por defecto para la primera sucursal si no existe
DO $$
DECLARE
    v_sucursal_id UUID;
BEGIN
    SELECT id INTO v_sucursal_id FROM sucursales LIMIT 1;
    IF v_sucursal_id IS NOT NULL THEN
        INSERT INTO config_impresion (sucursal_id)
        VALUES (v_sucursal_id)
        ON CONFLICT (sucursal_id) DO NOTHING;
    END IF;
END $$;

-- 3. Limpiar caché de esquema
NOTIFY pgrst, 'reload schema';
`;

async function run() {
    try {
        await client.connect();
        console.log("Conectado a Base de Datos de Supabase...");
        console.log("Creando tabla config_impresion...");
        await client.query(sql);
        console.log("¡Hecho! Tabla creada y configuración inicial insertada.");
    } catch (error) {
        console.error("Error ejecutando comando SQL:", error);
    } finally {
        await client.end();
    }
}

run();
