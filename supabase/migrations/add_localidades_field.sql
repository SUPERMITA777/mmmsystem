-- Add localidades JSON column to config_sucursal
ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS localidades JSONB DEFAULT '[]'::jsonb;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
