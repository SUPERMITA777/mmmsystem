/**
 * Conecta directamente a PostgreSQL de Supabase y ejecuta las migraciones
 * Uso: node scripts/pg-migrate.mjs
 */

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
    } catch (e) {
        console.error("No se pudo leer .env:", e.message);
    }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const DB_PASSWORD = process.argv[2] || process.env.DB_PASSWORD;

if (!DB_PASSWORD) {
    console.error("❌ Falta la contraseña. Uso: node scripts/pg-migrate.mjs TU_PASSWORD");
    process.exit(1);
}

// Conexión directa a PostgreSQL de Supabase
const connectionConfig = {
    host: `db.${PROJECT_REF}.supabase.co`,
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
};

const SCHEMA_SQL = /* sql */`
-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Sucursales
CREATE TABLE IF NOT EXISTS sucursales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  direccion TEXT,
  telefono TEXT,
  email TEXT,
  whatsapp_numero TEXT,
  slug TEXT UNIQUE NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categorías
CREATE TABLE IF NOT EXISTS categorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  imagen_url TEXT,
  orden INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Productos
CREATE TABLE IF NOT EXISTS productos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  nombre_interno TEXT,
  descripcion TEXT,
  precio NUMERIC(12,2) NOT NULL DEFAULT 0,
  precio_promocional NUMERIC(12,2),
  imagen_url TEXT,
  stock_actual INTEGER DEFAULT 0,
  stock_minimo INTEGER DEFAULT 0,
  control_stock BOOLEAN DEFAULT FALSE,
  tiempo_coccion INTEGER,
  visible_en_menu BOOLEAN DEFAULT TRUE,
  producto_oculto BOOLEAN DEFAULT FALSE,
  producto_sugerido BOOLEAN DEFAULT FALSE,
  activo BOOLEAN DEFAULT TRUE,
  destacado BOOLEAN DEFAULT FALSE,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  apellido TEXT,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  notas TEXT,
  total_pedidos INTEGER DEFAULT 0,
  total_gastado NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mesas
CREATE TABLE IF NOT EXISTS mesas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  nombre TEXT,
  capacidad INTEGER DEFAULT 4,
  estado TEXT DEFAULT 'libre',
  ubicacion TEXT,
  activa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sucursal_id, numero)
);

-- Métodos de pago
CREATE TABLE IF NOT EXISTS metodos_pago (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  codigo TEXT NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  requiere_confirmacion BOOLEAN DEFAULT FALSE,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sucursal_id, codigo)
);

-- Zonas de entrega
CREATE TABLE IF NOT EXISTS zonas_entrega (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  costo_envio NUMERIC(12,2) DEFAULT 0,
  minimo_compra NUMERIC(12,2) DEFAULT 0,
  envio_gratis_desde NUMERIC(12,2),
  tiempo_estimado_minutos INTEGER,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Repartidores
CREATE TABLE IF NOT EXISTS repartidores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  telefono TEXT NOT NULL,
  vehiculo TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pedidos
CREATE TABLE IF NOT EXISTS pedidos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  numero_pedido TEXT UNIQUE NOT NULL DEFAULT '',
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  cliente_nombre TEXT,
  cliente_telefono TEXT,
  cliente_direccion TEXT,
  mesa_id UUID REFERENCES mesas(id) ON DELETE SET NULL,
  repartidor_id UUID REFERENCES repartidores(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,
  estado TEXT DEFAULT 'pendiente',
  origen TEXT DEFAULT 'pos',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  descuento NUMERIC(12,2) DEFAULT 0,
  costo_envio NUMERIC(12,2) DEFAULT 0,
  propina NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  metodo_pago_id UUID REFERENCES metodos_pago(id),
  metodo_pago_nombre TEXT,
  zona_entrega_id UUID REFERENCES zonas_entrega(id),
  notas TEXT,
  notas_internas TEXT,
  fecha_entrega TIMESTAMPTZ,
  tiempo_preparacion_minutos INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items de pedidos
CREATE TABLE IF NOT EXISTS pedido_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id UUID REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES productos(id) ON DELETE SET NULL,
  nombre_producto TEXT NOT NULL,
  cantidad INTEGER NOT NULL DEFAULT 1,
  precio_unitario NUMERIC(12,2) NOT NULL,
  descuento NUMERIC(12,2) DEFAULT 0,
  subtotal NUMERIC(12,2) GENERATED ALWAYS AS ((cantidad * precio_unitario) - descuento) STORED,
  notas TEXT,
  estado TEXT DEFAULT 'pendiente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cajas
CREATE TABLE IF NOT EXISTS cajas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  usuario_id TEXT NOT NULL,
  fecha_apertura TIMESTAMPTZ DEFAULT NOW(),
  fecha_cierre TIMESTAMPTZ,
  monto_apertura NUMERIC(12,2) NOT NULL DEFAULT 0,
  monto_cierre NUMERIC(12,2),
  monto_esperado NUMERIC(12,2),
  diferencia NUMERIC(12,2),
  estado TEXT DEFAULT 'abierta',
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transacciones de caja
CREATE TABLE IF NOT EXISTS transacciones_caja (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caja_id UUID REFERENCES cajas(id) ON DELETE CASCADE,
  pedido_id UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,
  metodo_pago_id UUID REFERENCES metodos_pago(id),
  monto NUMERIC(12,2) NOT NULL,
  concepto TEXT,
  usuario_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Descuentos
CREATE TABLE IF NOT EXISTS descuentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  codigo TEXT,
  tipo TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  minimo_compra NUMERIC(12,2),
  maximo_descuento NUMERIC(12,2),
  fecha_inicio TIMESTAMPTZ,
  fecha_fin TIMESTAMPTZ,
  activo BOOLEAN DEFAULT TRUE,
  uso_limite INTEGER,
  uso_actual INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuración de sucursal
CREATE TABLE IF NOT EXISTS config_sucursal (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE UNIQUE,
  enable_delivery BOOLEAN DEFAULT TRUE,
  enable_takeaway BOOLEAN DEFAULT TRUE,
  enable_salon BOOLEAN DEFAULT FALSE,
  aceptar_pedidos BOOLEAN DEFAULT TRUE,
  confirmar_por_whatsapp BOOLEAN DEFAULT FALSE,
  pedidos_programados BOOLEAN DEFAULT TRUE,
  aceptar_propinas BOOLEAN DEFAULT TRUE,
  datos_cliente_obligatorios BOOLEAN DEFAULT TRUE,
  monto_minimo NUMERIC(12,2) DEFAULT 0,
  tiempo_preparacion_default INTEGER DEFAULT 30,
  notificar_nuevo_pedido BOOLEAN DEFAULT TRUE,
  notificar_pedido_listo BOOLEAN DEFAULT TRUE,
  whatsapp_numero TEXT,
  whatsapp_mensaje_template TEXT,
  punto_venta INTEGER,
  cuit TEXT,
  razon_social TEXT,
  condicion_iva TEXT,
  moneda TEXT DEFAULT 'ARS',
  impuesto_porcentaje NUMERIC(5,2) DEFAULT 0,
  cerrado_temporalmente BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Horarios
CREATE TABLE IF NOT EXISTS horarios_sucursal (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  dia INTEGER NOT NULL,
  cerrado BOOLEAN DEFAULT FALSE,
  apertura1 TIME,
  cierre1 TIME,
  apertura2 TIME,
  cierre2 TIME,
  disponible_en TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sucursal_id, dia)
);

-- Ingredientes
CREATE TABLE IF NOT EXISTS ingredientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  unidad TEXT NOT NULL,
  stock_actual NUMERIC(12,3) DEFAULT 0,
  stock_minimo NUMERIC(12,3) DEFAULT 0,
  costo_unitario NUMERIC(12,2) DEFAULT 0,
  proveedor TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Movimientos de stock
CREATE TABLE IF NOT EXISTS movimientos_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ingrediente_id UUID REFERENCES ingredientes(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL,
  cantidad NUMERIC(12,3) NOT NULL,
  motivo TEXT,
  pedido_id UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Función para número de pedido automático
CREATE OR REPLACE FUNCTION set_pedido_number()
RETURNS TRIGGER AS $$
DECLARE
  new_number TEXT;
  year_part TEXT;
  sequence_num INTEGER;
BEGIN
  IF NEW.numero_pedido IS NULL OR NEW.numero_pedido = '' THEN
    year_part := TO_CHAR(NOW(), 'YY');
    SELECT COALESCE(MAX(CAST(SUBSTRING(numero_pedido FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM pedidos
    WHERE numero_pedido LIKE 'PED-' || year_part || '%';
    NEW.numero_pedido := 'PED-' || year_part || LPAD(sequence_num::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_pedido_number_trigger ON pedidos;
CREATE TRIGGER set_pedido_number_trigger
  BEFORE INSERT ON pedidos
  FOR EACH ROW
  EXECUTE FUNCTION set_pedido_number();

-- Función updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_productos_updated_at ON productos;
CREATE TRIGGER update_productos_updated_at BEFORE UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pedidos_updated_at ON pedidos;
CREATE TRIGGER update_pedidos_updated_at BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_config_updated_at ON config_sucursal;
CREATE TRIGGER update_config_updated_at BEFORE UPDATE ON config_sucursal
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Índices
CREATE INDEX IF NOT EXISTS idx_productos_sucursal ON productos(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_sucursal ON pedidos(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_created_at ON pedidos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pedido_items_pedido ON pedido_items(pedido_id);
`;

const SEED_SQL = /* sql */`
-- ============================================================
-- DATOS INICIALES - MMM System
-- Sucursal de ejemplo con productos y configuración
-- ============================================================

-- 1. Sucursal principal
INSERT INTO sucursales (nombre, slug, direccion, telefono, activo)
VALUES ('MMM Sucursal Principal', 'mmm-principal', 'Av. Principal 123', '+54 11 1234-5678', true)
ON CONFLICT (slug) DO NOTHING;

-- 2. Configuración (referenciando la sucursal)
INSERT INTO config_sucursal (
  sucursal_id, enable_delivery, enable_takeaway, enable_salon,
  aceptar_pedidos, tiempo_preparacion_default, moneda, cerrado_temporalmente
)
SELECT id, true, true, false, true, 30, 'ARS', false
FROM sucursales WHERE slug = 'mmm-principal'
ON CONFLICT (sucursal_id) DO NOTHING;

-- 3. Horarios (Lun-Sab abiertos, Dom cerrado)
INSERT INTO horarios_sucursal (sucursal_id, dia, cerrado, apertura1, cierre1)
SELECT s.id, d.dia, d.cerrado, d.apertura1::TIME, d.cierre1::TIME
FROM sucursales s
CROSS JOIN (VALUES
  (0, false, '09:00', '23:00'),
  (1, false, '09:00', '23:00'),
  (2, false, '09:00', '23:00'),
  (3, false, '09:00', '23:00'),
  (4, false, '09:00', '23:00'),
  (5, false, '09:00', '23:00'),
  (6, true,  '09:00', '23:00')
) AS d(dia, cerrado, apertura1, cierre1)
WHERE s.slug = 'mmm-principal'
ON CONFLICT (sucursal_id, dia) DO NOTHING;

-- 4. Métodos de pago
INSERT INTO metodos_pago (sucursal_id, nombre, codigo, activo, orden)
SELECT s.id, m.nombre, m.codigo, true, m.orden
FROM sucursales s
CROSS JOIN (VALUES
  ('Efectivo',       'efectivo',       1),
  ('Transferencia',  'transferencia',  2),
  ('Tarjeta Débito', 'tarjeta_debito', 3),
  ('Tarjeta Crédito','tarjeta_credito',4),
  ('Mercado Pago',   'mercado_pago',   5)
) AS m(nombre, codigo, orden)
WHERE s.slug = 'mmm-principal'
ON CONFLICT (sucursal_id, codigo) DO NOTHING;

-- 5. Zona de entrega
INSERT INTO zonas_entrega (sucursal_id, nombre, descripcion, costo_envio, minimo_compra, tiempo_estimado_minutos, activo)
SELECT id, 'Zona Centro', 'Radio 5km del local', 500, 1500, 30, true
FROM sucursales WHERE slug = 'mmm-principal';

-- 6. Categorías
INSERT INTO categorias (sucursal_id, nombre, orden, activo)
SELECT s.id, c.nombre, c.orden, true
FROM sucursales s
CROSS JOIN (VALUES
  ('Hamburguesas', 1),
  ('Pizzas',       2),
  ('Bebidas',      3),
  ('Postres',      4)
) AS c(nombre, orden)
WHERE s.slug = 'mmm-principal';

-- 7. Productos
INSERT INTO productos (
  sucursal_id, categoria_id, nombre, descripcion,
  precio, orden, activo, visible_en_menu, producto_oculto, producto_sugerido
)
SELECT
  s.id,
  cat.id,
  p.nombre,
  p.descripcion,
  p.precio,
  p.orden,
  true, true, false,
  p.sugerido
FROM sucursales s
JOIN categorias cat ON cat.sucursal_id = s.id AND cat.nombre = p.categoria
CROSS JOIN (VALUES
  ('Hamburguesas', 'Hamburguesa Clásica',  'Pan brioche, carne 200g, lechuga, tomate, cheddar',    2500, 1, false),
  ('Hamburguesas', 'Hamburguesa BBQ',      'Pan negro, carne 200g, panceta, cebolla, salsa BBQ',   3200, 2, true),
  ('Hamburguesas', 'Hamburguesa Doble',    'Doble carne, doble cheddar, panceta crocante',         3800, 3, false),
  ('Pizzas',       'Pizza Mozzarella',     'Salsa de tomate, mozzarella, albahaca',                2800, 1, false),
  ('Pizzas',       'Pizza Napolitana',     'Salsa de tomate, mozzarella, tomate, ajo, albahaca',   3100, 2, true),
  ('Bebidas',      'Coca Cola 500ml',      NULL,                                                    800, 1, false),
  ('Bebidas',      'Fanta Naranja 500ml',  NULL,                                                    800, 2, false),
  ('Bebidas',      'Agua Mineral',         NULL,                                                    500, 3, false),
  ('Postres',      'Brownie con helado',   'Brownie tibio con helado de vainilla',                 1500, 1, true)
) AS p(categoria, nombre, descripcion, precio, orden, sugerido)
WHERE s.slug = 'mmm-principal';

-- 8. Mesas de salón (por si acaso)
INSERT INTO mesas (sucursal_id, numero, nombre, capacidad, estado, activa)
SELECT s.id, m.numero, m.nombre, m.capacidad, 'libre', true
FROM sucursales s
CROSS JOIN (VALUES
  (1, 'Mesa 1', 4),
  (2, 'Mesa 2', 4),
  (3, 'Mesa 3', 6),
  (4, 'Mesa 4', 2),
  (5, 'Barra 1', 2)
) AS m(numero, nombre, capacidad)
WHERE s.slug = 'mmm-principal'
ON CONFLICT (sucursal_id, numero) DO NOTHING;

-- 9. Pedidos de ejemplo (para ver el panel funcionando)
WITH suc AS (SELECT id FROM sucursales WHERE slug = 'mmm-principal')
INSERT INTO pedidos (sucursal_id, numero_pedido, tipo, estado, cliente_nombre, cliente_telefono, cliente_direccion, subtotal, costo_envio, total, metodo_pago_nombre, origen)
SELECT
  suc.id,
  '',
  p.tipo,
  p.estado,
  p.cliente,
  p.telefono,
  p.direccion,
  p.subtotal,
  p.envio,
  p.total,
  p.metodo,
  'pos'
FROM suc
CROSS JOIN (VALUES
  ('delivery',  'pendiente',    'Juan García',     '1155667788', 'Av. Corrientes 1500', 3300, 500, 3800,  'Efectivo'),
  ('takeaway',  'preparando',   'María López',     '1144556677', NULL,                  2500,   0, 2500,  'Mercado Pago'),
  ('delivery',  'listo',        'Carlos Rodríguez','1133445566', 'Callao 890',          6400, 500, 6900,  'Transferencia'),
  ('salon',     'preparando',   'Mesa 3',          NULL,         NULL,                  5600,   0, 5600,  'Tarjeta Débito'),
  ('delivery',  'en_camino',    'Laura Martínez',  '1122334455', 'Santa Fe 2100',       4200, 500, 4700,  'Efectivo'),
  ('takeaway',  'entregado',    'Pedro Silva',     '1111223344', NULL,                  1800,   0, 1800,  'Efectivo')
) AS p(tipo, estado, cliente, telefono, direccion, subtotal, envio, total, metodo);
`;

async function runQuery(client, sql, label) {
    process.stdout.write(`⏳ ${label}... `);
    try {
        await client.query(sql);
        console.log("✅");
        return true;
    } catch (e) {
        if (e.message.includes("already exists") || e.message.includes("duplicate key")) {
            console.log("⚠️  (ya existe)");
            return true;
        }
        console.log(`❌\n   Error: ${e.message.split("\n")[0]}`);
        return false;
    }
}

async function main() {
    console.log("=".repeat(55));
    console.log("  MMM SYSTEM - Migración PostgreSQL directa");
    console.log("=".repeat(55));
    console.log(`\n  Host: ${connectionConfig.host}`);
    console.log(`  Base: ${connectionConfig.database}\n`);

    const client = new Client(connectionConfig);

    try {
        process.stdout.write("🔌 Conectando a PostgreSQL... ");
        await client.connect();
        console.log("✅\n");

        // Ejecutar schema (en un solo bloque)
        await runQuery(client, SCHEMA_SQL, "Creando tablas y triggers");

        // Ejecutar datos iniciales
        await runQuery(client, SEED_SQL, "Insertando datos iniciales");

        // Verificar tablas creadas
        const { rows } = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

        console.log(`\n✅ Tablas en la BD (${rows.length}):`);
        rows.forEach((r) => console.log(`   • ${r.table_name}`));

        // Contar datos
        const counts = await Promise.all([
            client.query("SELECT COUNT(*) FROM sucursales"),
            client.query("SELECT COUNT(*) FROM categorias"),
            client.query("SELECT COUNT(*) FROM productos"),
            client.query("SELECT COUNT(*) FROM pedidos"),
            client.query("SELECT COUNT(*) FROM metodos_pago"),
        ]);

        console.log("\n📊 Datos cargados:");
        console.log(`   • Sucursales: ${counts[0].rows[0].count}`);
        console.log(`   • Categorías: ${counts[1].rows[0].count}`);
        console.log(`   • Productos:  ${counts[2].rows[0].count}`);
        console.log(`   • Pedidos:    ${counts[3].rows[0].count}`);
        console.log(`   • Métodos pago: ${counts[4].rows[0].count}`);

        console.log("\n" + "=".repeat(55));
        console.log("🎉 ¡Base de datos lista!");
        console.log('   Ahora corre: npm run dev');
        console.log("=".repeat(55));

    } catch (e) {
        console.error(`\n❌ Error de conexión: ${e.message}`);
        console.error("\nVerifica que la contraseña sea correcta.");
        console.error(`Host usado: ${connectionConfig.host}`);
        process.exit(1);
    } finally {
        await client.end();
    }
}

main();
