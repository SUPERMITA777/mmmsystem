-- ==========================================================
-- Migration 035: Tabla marketing_flyers (Generador con IA)
-- ==========================================================

CREATE TABLE IF NOT EXISTS marketing_flyers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE NOT NULL,
  producto_id UUID REFERENCES productos(id) ON DELETE SET NULL,
  producto_nombre TEXT,
  precio NUMERIC,
  ingredientes TEXT,
  prompt_usuario TEXT,
  estilo TEXT,
  formato TEXT DEFAULT 'story_9_16',
  imagen_url TEXT NOT NULL,
  copy_social TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_flyers_sucursal ON marketing_flyers(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_marketing_flyers_created ON marketing_flyers(created_at DESC);

ALTER TABLE marketing_flyers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Marketing Flyers: Ver de sucursal" ON marketing_flyers;
CREATE POLICY "Marketing Flyers: Ver de sucursal"
ON marketing_flyers FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Marketing Flyers: Gestionar de sucursal" ON marketing_flyers;
CREATE POLICY "Marketing Flyers: Gestionar de sucursal"
ON marketing_flyers FOR ALL
USING (auth.role() = 'authenticated');
