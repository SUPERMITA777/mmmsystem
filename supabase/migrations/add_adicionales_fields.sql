-- Add visibility and stock fields to Adicionales and Groups
ALTER TABLE grupos_adicionales ADD COLUMN IF NOT EXISTS visible BOOLEAN DEFAULT TRUE;
ALTER TABLE adicionales ADD COLUMN IF NOT EXISTS stock BOOLEAN DEFAULT TRUE;
ALTER TABLE adicionales ADD COLUMN IF NOT EXISTS restaurar BOOLEAN DEFAULT FALSE;
ALTER TABLE adicionales ADD COLUMN IF NOT EXISTS vender_sin_stock BOOLEAN DEFAULT FALSE;

-- Refresh PGRST
NOTIFY pgrst, 'reload schema';
