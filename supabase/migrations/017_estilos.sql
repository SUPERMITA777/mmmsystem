-- Migration 017: Add 'estilo' layout to config_sucursal
ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS estilo TEXT DEFAULT 'original';
NOTIFY pgrst, 'reload schema';
