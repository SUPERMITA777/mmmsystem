-- Fix missing sucursal_id in adicionales and producto_grupos_adicionales
-- This resolves the 400 Bad Request errors when filtering by sucursal_id

-- 1. Add sucursal_id to adicionales (if it doesn't exist)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'adicionales' AND column_name = 'sucursal_id') THEN
        ALTER TABLE adicionales ADD COLUMN sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. Add sucursal_id to producto_grupos_adicionales (if it doesn't exist)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'producto_grupos_adicionales' AND column_name = 'sucursal_id') THEN
        ALTER TABLE producto_grupos_adicionales ADD COLUMN sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Update existing records with sucursal_id from parent tables if possible
-- For adicionales, we can get sucursal_id from grupos_adicionales
UPDATE adicionales a
SET sucursal_id = g.sucursal_id
FROM grupos_adicionales g
WHERE a.grupo_id = g.id AND a.sucursal_id IS NULL;

-- For producto_grupos_adicionales, we can get sucursal_id from productos
UPDATE producto_grupos_adicionales pga
SET sucursal_id = p.sucursal_id
FROM productos p
WHERE pga.producto_id = p.id AND pga.sucursal_id IS NULL;

-- Refresh PGRST
NOTIFY pgrst, 'reload schema';
