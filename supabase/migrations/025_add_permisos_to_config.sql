-- Agregar columna permisos a config_sucursal para manejar accesos por rol
ALTER TABLE config_sucursal ADD COLUMN IF NOT EXISTS permisos JSONB DEFAULT '{}'::jsonb;
