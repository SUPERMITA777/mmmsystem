/**
 * Script para ejecutar SQL directamente en Supabase via Management API
 * Uso: node scripts/run-migrations.mjs
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
    } catch (e) {
        console.error("No se pudo leer .env:", e.message);
    }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// El PROJECT_REF está en la URL: https://[ref].supabase.co
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];

async function execSQL(sql, description) {
    process.stdout.write(`⏳ ${description}... `);

    try {
        // Supabase Management API para ejecutar SQL
        const res = await fetch(
            `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    // La Management API usa el service_role key como bearer token
                    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({ query: sql }),
            }
        );

        const responseText = await res.text();

        if (res.status === 200 || res.status === 201) {
            console.log("✅");
            return true;
        } else {
            let parsed;
            try { parsed = JSON.parse(responseText); } catch { parsed = responseText; }

            // Ignorar errores de "ya existe"
            const errMsg = typeof parsed === "object" ? (parsed.message || parsed.error || JSON.stringify(parsed)) : String(parsed);
            if (
                errMsg.includes("already exists") ||
                errMsg.includes("ya existe") ||
                errMsg.includes("duplicate")
            ) {
                console.log("⚠️  (ya existe, OK)");
                return true;
            }

            console.log(`❌ [${res.status}] ${errMsg.substring(0, 200)}`);
            return false;
        }
    } catch (e) {
        console.log(`❌ Error de red: ${e.message}`);
        return false;
    }
}

const SCHEMA_SQL = `
-- Habilitar extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
  usuario_id UUID NOT NULL,
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

-- Descuentos
CREATE TABLE IF NOT EXISTS descuentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  codigo TEXT,
  tipo TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  minimo_compra NUMERIC(12,2),
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

-- Trigger para numero de pedido
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
`;

const DISABLE_RLS_SQL = `
ALTER TABLE sucursales DISABLE ROW LEVEL SECURITY;
ALTER TABLE categorias DISABLE ROW LEVEL SECURITY;
ALTER TABLE productos DISABLE ROW LEVEL SECURITY;
ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE mesas DISABLE ROW LEVEL SECURITY;
ALTER TABLE metodos_pago DISABLE ROW LEVEL SECURITY;
ALTER TABLE zonas_entrega DISABLE ROW LEVEL SECURITY;
ALTER TABLE repartidores DISABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos DISABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE cajas DISABLE ROW LEVEL SECURITY;
ALTER TABLE descuentos DISABLE ROW LEVEL SECURITY;
ALTER TABLE config_sucursal DISABLE ROW LEVEL SECURITY;
ALTER TABLE horarios_sucursal DISABLE ROW LEVEL SECURITY;
`;

async function main() {
    console.log("=".repeat(50));
    console.log("  MMM SYSTEM - Ejecutar Migraciones SQL");
    console.log("=".repeat(50));
    console.log(`\n  Proyecto: ${PROJECT_REF}`);
    console.log(`  URL: ${SUPABASE_URL}\n`);

    // 1. Crear tablas
    const ok1 = await execSQL(SCHEMA_SQL, "Creando tablas (schema completo)");

    if (!ok1) {
        console.log("\n⚠️  La Management API no permitió ejecutar SQL directamente.");
        console.log("    Esto es normal si no tienes acceso a la API de administración.");
        console.log("\n📋 Ejecuta manualmente en el SQL Editor de Supabase:");
        console.log(`   https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`);
        console.log("\n   Copia el contenido de: supabase/migrations/001_initial_schema.sql");
        process.exit(1);
    }

    // 2. Deshabilitar RLS para desarrollo
    await execSQL(DISABLE_RLS_SQL, "Deshabilitando RLS (modo desarrollo)");

    console.log("\n✅ Migraciones ejecutadas!");
    console.log("\n⏳ Cargando datos iniciales...");

    // 3. Correr el script de datos
    const { spawn } = await import("child_process");
    spawn("node", ["scripts/setup-db.mjs"], {
        stdio: "inherit",
        cwd: join(__dirname, ".."),
    });
}

main().catch((e) => {
    console.error("\n❌ Error:", e.message);
    process.exit(1);
});
