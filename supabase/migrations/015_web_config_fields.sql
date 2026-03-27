-- Migration 015: Additional fields for web/frontend configuration
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS mensaje_bienvenida TEXT;
ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS mensaje_cerrado TEXT DEFAULT 'Estamos cerrados en este momento';
ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS texto_delivery TEXT DEFAULT 'DELIVERY';
ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS texto_takeaway TEXT DEFAULT 'RETIRO EN LOCAL';
ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS tiktok_url TEXT;
NOTIFY pgrst, 'reload schema';
