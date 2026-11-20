-- ═══════════════════════════════════════════════════════════
-- MMM SYSTEM - AGENTE IA v2 - Tracking de Tokens y Costos
-- ═══════════════════════════════════════════════════════════
-- Ejecutar en Supabase SQL Editor (idempotente)

CREATE TABLE IF NOT EXISTS ai_token_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  source TEXT DEFAULT 'whatsapp',
  prompt_tokens INTEGER DEFAULT 0,
  cached_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  estimated_cost_usd NUMERIC(10,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_token_usage_sucursal_date
  ON ai_token_usage(sucursal_id, created_at DESC);

ALTER TABLE ai_token_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role access" ON ai_token_usage;
CREATE POLICY "Service role access" ON ai_token_usage
  FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
