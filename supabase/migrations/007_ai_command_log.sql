-- ============================================
-- AI Command Log - Registro de cambios del asistente IA
-- ============================================

CREATE TABLE IF NOT EXISTS ai_command_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id),
  comando_original TEXT NOT NULL,
  comando_interpretado TEXT NOT NULL,
  tabla_afectada TEXT NOT NULL,
  registro_id UUID NOT NULL,
  registro_nombre TEXT,
  campo_modificado TEXT NOT NULL,
  valor_anterior TEXT,
  valor_nuevo TEXT,
  estado TEXT DEFAULT 'ejecutado',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_command_log_sucursal ON ai_command_log(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_ai_command_log_created ON ai_command_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_command_log_estado ON ai_command_log(estado);
