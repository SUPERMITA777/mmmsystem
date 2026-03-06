-- Migration to ensure stock tables have sucursal_id and RLS
DO $$ 
BEGIN 
    -- 1. Add sucursal_id to ingredientes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ingredientes' AND column_name = 'sucursal_id') THEN
        ALTER TABLE ingredientes ADD COLUMN sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE;
    END IF;

    -- 2. Add sucursal_id to recetas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recetas' AND column_name = 'sucursal_id') THEN
        ALTER TABLE recetas ADD COLUMN sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE;
    END IF;

    -- 3. Add sucursal_id to movimientos_stock
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'movimientos_stock' AND column_name = 'sucursal_id') THEN
        ALTER TABLE movimientos_stock ADD COLUMN sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Update existing recetas with sucursal_id from productos
UPDATE recetas r
SET sucursal_id = p.sucursal_id
FROM productos p
WHERE r.producto_id = p.id AND r.sucursal_id IS NULL;

-- 5. Enable RLS and add policies
ALTER TABLE ingredientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_stock ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Ingredientes: Ver de sucursal" ON ingredientes;
    DROP POLICY IF EXISTS "Ingredientes: Modificar de sucursal" ON ingredientes;
    DROP POLICY IF EXISTS "Recetas: Ver de sucursal" ON recetas;
    DROP POLICY IF EXISTS "Recetas: Modificar de sucursal" ON recetas;
    DROP POLICY IF EXISTS "Movimientos_stock: Ver de sucursal" ON movimientos_stock;
    DROP POLICY IF EXISTS "Movimientos_stock: Crear de sucursal" ON movimientos_stock;
    
    -- Also old ones from initial schema if they exist
    DROP POLICY IF EXISTS "Ingredientes: Ver todos" ON ingredientes;
    DROP POLICY IF EXISTS "Ingredientes: Modificar usuarios autenticados" ON ingredientes;
    DROP POLICY IF EXISTS "Movimientos_stock: Ver usuarios autenticados" ON movimientos_stock;
    DROP POLICY IF EXISTS "Movimientos_stock: Crear usuarios autenticados" ON movimientos_stock;
END $$;

-- Create new policies
CREATE POLICY "Ingredientes: Ver de sucursal" ON ingredientes FOR SELECT USING (is_super_admin() OR sucursal_id = get_user_sucursal_id());
CREATE POLICY "Ingredientes: Modificar de sucursal" ON ingredientes FOR ALL USING (is_super_admin() OR sucursal_id = get_user_sucursal_id());

CREATE POLICY "Recetas: Ver de sucursal" ON recetas FOR SELECT USING (is_super_admin() OR sucursal_id = get_user_sucursal_id());
CREATE POLICY "Recetas: Modificar de sucursal" ON recetas FOR ALL USING (is_super_admin() OR sucursal_id = get_user_sucursal_id());

CREATE POLICY "Movimientos_stock: Ver de sucursal" ON movimientos_stock FOR SELECT USING (is_super_admin() OR sucursal_id = get_user_sucursal_id());
CREATE POLICY "Movimientos_stock: Crear de sucursal" ON movimientos_stock FOR INSERT WITH CHECK (is_super_admin() OR sucursal_id = get_user_sucursal_id());

-- Notify PGRST
NOTIFY pgrst, 'reload schema';
