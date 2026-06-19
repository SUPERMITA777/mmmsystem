-- Migración para añadir contador de envíos de WhatsApp

ALTER TABLE mundial_predicciones
ADD COLUMN IF NOT EXISTS whatsapp_enviado_count INTEGER DEFAULT 0;
