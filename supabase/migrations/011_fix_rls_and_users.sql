-- 1. Fix helper functions to bypass RLS (SECURITY DEFINER)
-- These functions are used in policies, so they MUST be security definer to avoid recursion
CREATE OR REPLACE FUNCTION get_user_sucursal_id() 
RETURNS UUID 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sucursal_id FROM usuarios WHERE id = auth.uid();
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION is_super_admin() 
RETURNS BOOLEAN 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios 
    WHERE id = auth.uid() AND rol = 'super_admin'
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION is_sucursal_admin() 
RETURNS BOOLEAN 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios 
    WHERE id = auth.uid() AND rol IN ('super_admin', 'admin')
  );
$$ LANGUAGE sql STABLE;

-- 2. Ensure RLS is enabled for usuarios
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- 3. Add pin column if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'pin') THEN
    ALTER TABLE usuarios ADD COLUMN pin TEXT;
  END IF;
END $$;

-- 4. Create policies for usuarios
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "lectura_autenticados" ON usuarios;
    DROP POLICY IF EXISTS "admin_all" ON usuarios;
    DROP POLICY IF EXISTS "self_update" ON usuarios;
    DROP POLICY IF EXISTS "service_role_unrestricted" ON usuarios;
    DROP POLICY IF EXISTS "Usuarios pueden ver todos los usuarios" ON usuarios;
    DROP POLICY IF EXISTS "Usuarios: Ver de sucursal" ON usuarios;
    DROP POLICY IF EXISTS "Usuarios: Modificar solo admins" ON usuarios;
    DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio perfil" ON usuarios;
END $$;

-- Read policy: All authenticated users can see other users (needed for the dashboard and mentions)
CREATE POLICY "lectura_autenticados" ON usuarios FOR SELECT TO authenticated USING (true);

-- Admin policy: Admins can do everything
CREATE POLICY "admin_all" ON usuarios FOR ALL TO authenticated 
USING (is_sucursal_admin()) 
WITH CHECK (is_sucursal_admin());

-- Self policy: Any user can update their own row (e.g. for profile updates)
CREATE POLICY "self_update" ON usuarios FOR UPDATE TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Service role: Full access
CREATE POLICY "service_role_unrestricted" ON usuarios FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. Ensure the first user is super_admin and has a sucursal_id if possible
DO $$
DECLARE
    first_sucursal_id UUID;
    first_user_id UUID;
BEGIN
    SELECT id INTO first_sucursal_id FROM sucursales LIMIT 1;
    SELECT id INTO first_user_id FROM auth.users ORDER BY created_at LIMIT 1;
    
    IF first_user_id IS NOT NULL THEN
        UPDATE usuarios 
        SET rol = 'super_admin', 
            sucursal_id = COALESCE(usuarios.sucursal_id, first_sucursal_id)
        WHERE id = first_user_id;
    END IF;
END $$;
