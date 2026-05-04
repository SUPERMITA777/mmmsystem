-- 1. Ensure RLS is enabled and columns exist
DO $$ 
BEGIN
    -- Ensure columns exist in grupos_adicionales
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'grupos_adicionales' AND column_name = 'visible') THEN
        ALTER TABLE grupos_adicionales ADD COLUMN visible BOOLEAN DEFAULT TRUE;
    END IF;

    -- Ensure columns exist in adicionales
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'adicionales' AND column_name = 'impresora') THEN
        ALTER TABLE adicionales ADD COLUMN impresora TEXT;
    END IF;
END $$;

ALTER TABLE grupos_adicionales ENABLE ROW LEVEL SECURITY;
ALTER TABLE adicionales ENABLE ROW LEVEL SECURITY;

-- 2. GRUPOS_ADICIONALES Policies
DROP POLICY IF EXISTS "Grupos Adicionales: Ver de sucursal" ON grupos_adicionales;
DROP POLICY IF EXISTS "Grupos Adicionales: Admin full access" ON grupos_adicionales;

CREATE POLICY "Grupos Adicionales: Ver de sucursal"
  ON grupos_adicionales FOR SELECT
  USING (
    sucursal_id = get_user_sucursal_id() OR
    is_super_admin() OR
    auth.uid() IS NULL -- Allow public viewing if needed by storefront
  );

CREATE POLICY "Grupos Adicionales: Admin full access"
  ON grupos_adicionales FOR ALL
  USING (is_sucursal_admin())
  WITH CHECK (is_sucursal_admin());

-- 3. ADICIONALES Policies
DROP POLICY IF EXISTS "Adicionales: Ver de sucursal" ON adicionales;
DROP POLICY IF EXISTS "Adicionales: Admin full access" ON adicionales;

CREATE POLICY "Adicionales: Ver de sucursal"
  ON adicionales FOR SELECT
  USING (
    sucursal_id = get_user_sucursal_id() OR
    is_super_admin() OR
    auth.uid() IS NULL
  );

CREATE POLICY "Adicionales: Admin full access"
  ON adicionales FOR ALL
  USING (is_sucursal_admin())
  WITH CHECK (is_sucursal_admin());

-- Notify PGRST
NOTIFY pgrst, 'reload schema';
