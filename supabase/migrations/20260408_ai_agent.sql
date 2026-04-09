-- ═══════════════════════════════════════════════════════════
-- MMM SYSTEM - AGENTE IA AUTÓNOMO - Migración de Base de Datos
-- ═══════════════════════════════════════════════════════════
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar columna de configuración del agente IA en config_sucursal
ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS ai_agent_config JSONB DEFAULT '{
  "enabled": false,
  "whatsapp_enabled": false,
  "system_prompt": "",
  "training_snippets": [],
  "allowed_operations": ["view_products", "view_orders"],
  "auto_reply": true,
  "business_hours_only": false,
  "max_tokens": 1000
}'::jsonb;

-- 2. Tabla de conversaciones WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  sender_phone TEXT NOT NULL,
  sender_name TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para la tabla de conversaciones
CREATE INDEX IF NOT EXISTS idx_wa_conv_sucursal ON whatsapp_conversations(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_wa_conv_sender ON whatsapp_conversations(sender_phone);
CREATE INDEX IF NOT EXISTS idx_wa_conv_status ON whatsapp_conversations(status);

-- 3. Tabla de mensajes WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  sender_phone TEXT NOT NULL,
  message_text TEXT NOT NULL,
  reply_text TEXT,
  from_me BOOLEAN DEFAULT FALSE,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para la tabla de mensajes
CREATE INDEX IF NOT EXISTS idx_wa_msg_conv ON whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_wa_msg_sucursal ON whatsapp_messages(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_wa_msg_sender ON whatsapp_messages(sender_phone);
CREATE INDEX IF NOT EXISTS idx_wa_msg_created ON whatsapp_messages(created_at DESC);

-- 4. Tabla de acciones administrativas del agente
CREATE TABLE IF NOT EXISTS ai_agent_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_details JSONB DEFAULT '{}',
  source TEXT DEFAULT 'whatsapp',
  sender_phone TEXT,
  status TEXT DEFAULT 'executed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para la tabla de acciones
CREATE INDEX IF NOT EXISTS idx_ai_actions_sucursal ON ai_agent_actions(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_ai_actions_type ON ai_agent_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_ai_actions_created ON ai_agent_actions(created_at DESC);

-- 5. Políticas RLS (Row Level Security)
-- Nota: Dado que usamos supabaseAdmin (service role), estas políticas
-- son para protección adicional en caso de acceso directo.

ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_actions ENABLE ROW LEVEL SECURITY;

-- Política: Service role puede hacer todo
CREATE POLICY IF NOT EXISTS "Service role access" ON whatsapp_conversations
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Service role access" ON whatsapp_messages
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Service role access" ON ai_agent_actions
  FOR ALL USING (true) WITH CHECK (true);
