-- ============================================================
-- RULETA DE PREMIOS PREMIUM — Migración de tablas
-- ============================================================

-- 1. Tabla de Ruletas
CREATE TABLE IF NOT EXISTS ruletas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sucursal_id uuid REFERENCES sucursales(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  activa boolean DEFAULT true,
  whatsapp_negocio text,
  subtitulo_logo text,
  short_code text UNIQUE,
  whatsapp_emojis text DEFAULT '🎡🎁',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Tabla de Segmentos (Premios) de la Ruleta
CREATE TABLE IF NOT EXISTS ruleta_premios (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ruleta_id uuid REFERENCES ruletas(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  descripcion text,
  probabilidad integer DEFAULT 10, -- Peso relativo (1-100)
  color text DEFAULT '#7B1FA2',
  activa boolean DEFAULT true,
  imagen_url text, -- URL de la imagen en Supabase Storage
  validez text, -- Ej: "Vence en 24hs"
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Tabla de Leads (Participaciones)
CREATE TABLE IF NOT EXISTS ruleta_leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ruleta_id uuid REFERENCES ruletas(id) ON DELETE CASCADE,
  nombre_cliente text NOT NULL,
  whatsapp_cliente text NOT NULL,
  premio_id uuid REFERENCES ruleta_premios(id) ON DELETE SET NULL,
  premio_nombre text, -- Guardamos el nombre por si el premio se borra luego
  created_at timestamptz DEFAULT now(),
  -- Evitar múltiples participaciones con el mismo número por ruleta
  UNIQUE(ruleta_id, whatsapp_cliente)
);

-- 4. Row Level Security
ALTER TABLE ruletas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ruleta_premios ENABLE ROW LEVEL SECURITY;
ALTER TABLE ruleta_leads ENABLE ROW LEVEL SECURITY;

-- Políticas (ajustar según necesidades)
CREATE POLICY "allow_all_ruletas" ON ruletas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_ruleta_premios" ON ruleta_premios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_ruleta_leads" ON ruleta_leads FOR ALL USING (true) WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ruletas_sucursal ON ruletas(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_ruleta_premios_ruleta ON ruleta_premios(ruleta_id);
CREATE INDEX IF NOT EXISTS idx_ruleta_leads_ruleta ON ruleta_leads(ruleta_id);
CREATE INDEX IF NOT EXISTS idx_ruleta_leads_whatsapp ON ruleta_leads(whatsapp_cliente);
