-- ============================================
-- FIX: SECURITY DEFINER for RLS Helpers
-- ============================================

-- This migration updates the helper functions to use SECURITY DEFINER.
-- This allows them to query the 'usuarios' table regardless of the current user's RLS policies,
-- which is necessary to avoid recursion and ensure policies can always check roles.

-- 1. get_user_sucursal_id
CREATE OR REPLACE FUNCTION get_user_sucursal_id() 
RETURNS UUID AS $$
  SELECT sucursal_id FROM usuarios WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. is_super_admin
CREATE OR REPLACE FUNCTION is_super_admin() 
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios 
    WHERE id = auth.uid() AND rol = 'super_admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 3. is_sucursal_admin
CREATE OR REPLACE FUNCTION is_sucursal_admin() 
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios 
    WHERE id = auth.uid() AND rol IN ('super_admin', 'admin')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Also update the GRUPOS_ADICIONALES and ADICIONALES policies to be more robust
-- using a direct sucursal_id check where possible.

DROP POLICY IF EXISTS "Grupos Adicionales: Admin full access" ON grupos_adicionales;
CREATE POLICY "Grupos Adicionales: Admin full access"
  ON grupos_adicionales FOR ALL
  TO authenticated
  USING (
    is_super_admin() OR 
    (is_sucursal_admin() AND (sucursal_id = get_user_sucursal_id() OR sucursal_id IS NULL))
  )
  WITH CHECK (
    is_super_admin() OR 
    (is_sucursal_admin() AND (sucursal_id = get_user_sucursal_id() OR sucursal_id IS NULL))
  );

DROP POLICY IF EXISTS "Adicionales: Admin full access" ON adicionales;
CREATE POLICY "Adicionales: Admin full access"
  ON adicionales FOR ALL
  TO authenticated
  USING (
    is_super_admin() OR 
    (is_sucursal_admin() AND (sucursal_id = get_user_sucursal_id() OR sucursal_id IS NULL))
  )
  WITH CHECK (
    is_super_admin() OR 
    (is_sucursal_admin() AND (sucursal_id = get_user_sucursal_id() OR sucursal_id IS NULL))
  );

-- Refresh PGRST
NOTIFY pgrst, 'reload schema';
