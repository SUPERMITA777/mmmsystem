-- ============================================
-- Migration 1009: Normalize RLS for Fichas Técnicas & Items
-- ============================================

-- Drop legacy and duplicate policies
DROP POLICY IF EXISTS "Fichas Tecnicas: Ver de sucursal" ON fichas_tecnicas;
DROP POLICY IF EXISTS "Fichas Tecnicas: Modificar de sucursal" ON fichas_tecnicas;
DROP POLICY IF EXISTS "Fichas Técnicas: Ver de sucursal" ON fichas_tecnicas;
DROP POLICY IF EXISTS "Fichas Técnicas: Modificar de sucursal" ON fichas_tecnicas;
DROP POLICY IF EXISTS "fichas_tecnicas_auth_all" ON fichas_tecnicas;
DROP POLICY IF EXISTS "fichas_tecnicas_select" ON fichas_tecnicas;

DROP POLICY IF EXISTS "Ficha Items: Ver de sucursal" ON ficha_tecnica_items;
DROP POLICY IF EXISTS "Ficha Items: Modificar de sucursal" ON ficha_tecnica_items;
DROP POLICY IF EXISTS "ficha_tecnica_items_auth_all" ON ficha_tecnica_items;
DROP POLICY IF EXISTS "ficha_tecnica_items_select" ON ficha_tecnica_items;

-- Ensure RLS is enabled
ALTER TABLE fichas_tecnicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ficha_tecnica_items ENABLE ROW LEVEL SECURITY;

-- Standard policies matching migration 034
CREATE POLICY "fichas_tecnicas_select" ON fichas_tecnicas
  FOR SELECT
  USING (is_super_admin() OR sucursal_id = get_user_sucursal_id());

CREATE POLICY "fichas_tecnicas_auth_all" ON fichas_tecnicas
  FOR ALL TO authenticated
  USING (is_super_admin() OR sucursal_id = get_user_sucursal_id())
  WITH CHECK (is_super_admin() OR sucursal_id = get_user_sucursal_id());

CREATE POLICY "ficha_tecnica_items_select" ON ficha_tecnica_items
  FOR SELECT
  USING (is_super_admin() OR sucursal_id = get_user_sucursal_id());

CREATE POLICY "ficha_tecnica_items_auth_all" ON ficha_tecnica_items
  FOR ALL TO authenticated
  USING (is_super_admin() OR sucursal_id = get_user_sucursal_id())
  WITH CHECK (is_super_admin() OR sucursal_id = get_user_sucursal_id());

NOTIFY pgrst, 'reload schema';
