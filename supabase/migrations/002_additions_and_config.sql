-- ============================================
-- MMM SYSTEM DELIVERY - Adicionales y Config Extendida
-- ============================================

-- Agregar campos faltantes a config_sucursal
ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS color_primario TEXT DEFAULT '#f97316';
ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS color_secundario TEXT DEFAULT '#1a1a2e';
ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS facebook_url TEXT;

-- Categorías de insumos (para agrupar en la vista de stock)
ALTER TABLE ingredientes ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'General';

-- Adicionales (grupos de opciones que se pueden asignar a productos)
CREATE TABLE IF NOT EXISTS grupos_adicionales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo_seleccion TEXT DEFAULT 'multiple', -- unico, multiple, cantidad
  minimo INTEGER DEFAULT 0,
  maximo INTEGER,
  obligatorio BOOLEAN DEFAULT FALSE,
  orden INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opciones_adicional (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grupo_id UUID REFERENCES grupos_adicionales(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  precio_adicional NUMERIC(12,2) DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS producto_grupos_adicionales (
  producto_id UUID REFERENCES productos(id) ON DELETE CASCADE,
  grupo_id UUID REFERENCES grupos_adicionales(id) ON DELETE CASCADE,
  PRIMARY KEY (producto_id, grupo_id)
);

-- Triggers para updated_at en nuevas tablas
CREATE TRIGGER update_grupos_adicionales_updated_at BEFORE UPDATE ON grupos_adicionales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_opciones_adicional_updated_at BEFORE UPDATE ON opciones_adicional
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Agregar campo adicionales a pedido_items
ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS adicionales JSONB DEFAULT '[]'::jsonb;

