-- ============================================
-- MMM SYSTEM DELIVERY - Flyer de Sucursal
-- ============================================

CREATE TABLE IF NOT EXISTS sucursal_flyers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE UNIQUE,
  imagen_url TEXT NOT NULL,
  producto_id UUID REFERENCES productos(id) ON DELETE SET NULL,
  es_eterno BOOLEAN DEFAULT FALSE,
  vence_at TIMESTAMPTZ,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE sucursal_flyers ENABLE ROW LEVEL SECURITY;

-- Políticas
DROP POLICY IF EXISTS "Permitir lectura pública de flyers" ON sucursal_flyers;
CREATE POLICY "Permitir lectura pública de flyers"
ON sucursal_flyers FOR SELECT
USING (activo = true AND (es_eterno = true OR vence_at > NOW()));

DROP POLICY IF EXISTS "Permitir a admins gestionar flyers" ON sucursal_flyers;
CREATE POLICY "Permitir a admins gestionar flyers"
ON sucursal_flyers FOR ALL
USING (auth.role() = 'authenticated');

-- Trigger para updated_at
CREATE TRIGGER update_sucursal_flyers_updated_at BEFORE UPDATE ON sucursal_flyers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
