-- ============================================
-- DEBUG: Permissive RLS for Adicionales
-- ============================================

-- Temporary permissive policies to diagnose if the issue is sucursal_id mismatch
-- or the role check itself.

DROP POLICY IF EXISTS "Grupos Adicionales: Admin full access" ON grupos_adicionales;
CREATE POLICY "Grupos Adicionales: Admin full access"
  ON grupos_adicionales FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Adicionales: Admin full access" ON adicionales;
CREATE POLICY "Adicionales: Admin full access"
  ON adicionales FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Also ensure the public can still SELECT (for the storefront)
DROP POLICY IF EXISTS "Grupos Adicionales: Ver de sucursal" ON grupos_adicionales;
CREATE POLICY "Grupos Adicionales: Ver de sucursal"
  ON grupos_adicionales FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Adicionales: Ver de sucursal" ON adicionales;
CREATE POLICY "Adicionales: Ver de sucursal"
  ON adicionales FOR SELECT
  USING (true);

-- Refresh PGRST
NOTIFY pgrst, 'reload schema';
