-- ==========================================================
-- Migration 036: Marketing Brand Config (Entrenamiento de Marca)
-- ==========================================================

CREATE TABLE IF NOT EXISTS marketing_brand_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE UNIQUE NOT NULL,
  logos JSONB DEFAULT '[]'::jsonb,
  estilo_default TEXT DEFAULT 'gourmet',
  colores_marca JSONB DEFAULT '{}'::jsonb,
  tono_comunicacion TEXT,
  instrucciones_permanentes TEXT,
  slogan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_brand_config_sucursal ON marketing_brand_config(sucursal_id);

ALTER TABLE marketing_brand_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Marketing Brand Config: Ver" ON marketing_brand_config;
CREATE POLICY "Marketing Brand Config: Ver"
ON marketing_brand_config FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Marketing Brand Config: Gestionar" ON marketing_brand_config;
CREATE POLICY "Marketing Brand Config: Gestionar"
ON marketing_brand_config FOR ALL
USING (auth.role() = 'authenticated');

-- Add prompt_correccion column to marketing_flyers for correction tracking
ALTER TABLE marketing_flyers ADD COLUMN IF NOT EXISTS prompt_correccion TEXT;
-- Add flyer_origen_id to track which flyer was corrected
ALTER TABLE marketing_flyers ADD COLUMN IF NOT EXISTS flyer_origen_id UUID REFERENCES marketing_flyers(id) ON DELETE SET NULL;
