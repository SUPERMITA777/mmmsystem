-- Consolidated Migration to fix 400 Errors in Stock Management
-- Adds missing columns and ensures RLS policies are correct

DO $$ 
BEGIN 
    -- 1. Ensure sucursal_id exists in ingredientes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ingredientes' AND column_name = 'sucursal_id') THEN
        ALTER TABLE ingredientes ADD COLUMN sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE;
    END IF;

    -- 2. Add categoria to ingredientes (This was the main cause of the 400 error)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ingredientes' AND column_name = 'categoria') THEN
        ALTER TABLE ingredientes ADD COLUMN categoria TEXT DEFAULT 'General';
    END IF;

    -- 3. Ensure sucursal_id exists in recetas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recetas' AND column_name = 'sucursal_id') THEN
        ALTER TABLE recetas ADD COLUMN sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE;
    END IF;

    -- 4. Ensure sucursal_id exists in movimientos_stock
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'movimientos_stock' AND column_name = 'sucursal_id') THEN
        ALTER TABLE movimientos_stock ADD COLUMN sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 5. Enable RLS and add policies
ALTER TABLE ingredientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_stock ENABLE ROW LEVEL SECURITY;

-- 6. Ensure get_user_sucursal_id check is robust
-- Drop and recreate policies to ensure they use sucursal_id
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Ingredientes: Ver de sucursal" ON ingredientes;
    DROP POLICY IF EXISTS "Ingredientes: Modificar de sucursal" ON ingredientes;
    DROP POLICY IF EXISTS "Recetas: Ver de sucursal" ON recetas;
    DROP POLICY IF EXISTS "Recetas: Modificar de sucursal" ON recetas;
    DROP POLICY IF EXISTS "Movimientos_stock: Ver de sucursal" ON movimientos_stock;
    DROP POLICY IF EXISTS "Movimientos_stock: Crear de sucursal" ON movimientos_stock;
END $$;

-- 7. Create new policies
CREATE POLICY "Ingredientes: Ver de sucursal" ON ingredientes FOR SELECT USING (sucursal_id = (SELECT sucursal_id FROM usuarios WHERE id = auth.uid()));
CREATE POLICY "Ingredientes: Modificar de sucursal" ON ingredientes FOR ALL USING (sucursal_id = (SELECT sucursal_id FROM usuarios WHERE id = auth.uid()));

CREATE POLICY "Recetas: Ver de sucursal" ON recetas FOR SELECT USING (sucursal_id = (SELECT sucursal_id FROM usuarios WHERE id = auth.uid()));
CREATE POLICY "Recetas: Modificar de sucursal" ON recetas FOR ALL USING (sucursal_id = (SELECT sucursal_id FROM usuarios WHERE id = auth.uid()));

CREATE POLICY "Movimientos_stock: Ver de sucursal" ON movimientos_stock FOR SELECT USING (sucursal_id = (SELECT sucursal_id FROM usuarios WHERE id = auth.uid()));
CREATE POLICY "Movimientos_stock: Crear de sucursal" ON movimientos_stock FOR INSERT WITH CHECK (sucursal_id = (SELECT sucursal_id FROM usuarios WHERE id = auth.uid()));

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
