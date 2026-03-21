-- Migration to add fecha_desde and fecha_hasta to sucursal_flyers
ALTER TABLE sucursal_flyers 
ADD COLUMN IF NOT EXISTS fecha_desde timestamptz,
ADD COLUMN IF NOT EXISTS fecha_hasta timestamptz;
