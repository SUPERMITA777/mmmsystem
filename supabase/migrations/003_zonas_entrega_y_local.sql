-- ============================================
-- MMM SYSTEM DELIVERY - Zonas de Entrega y Ubicación del Local
-- ============================================

-- Tabla de zonas de entrega
CREATE TABLE IF NOT EXISTS zonas_entrega (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  costo_envio NUMERIC(12,2) DEFAULT 0,
  minimo_compra NUMERIC(12,2) DEFAULT 0,
  envio_gratis_desde NUMERIC(12,2),
  tiempo_estimado_minutos INTEGER,
  tipo_precio TEXT DEFAULT 'fijo',   -- 'fijo' | 'por_km'
  precio_por_km NUMERIC(12,2) DEFAULT 0,
  polygon_coords JSONB DEFAULT NULL, -- array de {lat, lng}
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para updated_at
CREATE TRIGGER update_zonas_entrega_updated_at
  BEFORE UPDATE ON zonas_entrega
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Columnas de ubicación del local en config_sucursal
ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS local_lat  DOUBLE PRECISION DEFAULT NULL;
ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS local_lng  DOUBLE PRECISION DEFAULT NULL;
ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS local_direccion TEXT DEFAULT NULL;
