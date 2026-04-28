-- Forzar políticas de RLS para la tabla usuarios
-- Asegurarnos de que todos los usuarios autenticados puedan ver la lista de equipo
-- y evitar la recursión infinita causada por políticas FOR ALL que consultan la misma tabla.

-- Crear la función si no existe (SECURITY DEFINER permite saltar RLS para evitar recursión)
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

DO $$ 
BEGIN
    -- Eliminar TODAS las políticas existentes que puedan estar causando conflictos o recursión
    DROP POLICY IF EXISTS "Usuarios pueden ver todos los usuarios" ON usuarios;
    DROP POLICY IF EXISTS "Permitir lectura a autenticados" ON usuarios;
    DROP POLICY IF EXISTS "Admins can view all users" ON usuarios;
    DROP POLICY IF EXISTS "lectura_autenticados" ON usuarios;
    DROP POLICY IF EXISTS "admin_all" ON usuarios;
    DROP POLICY IF EXISTS "self_update" ON usuarios;
    DROP POLICY IF EXISTS "service_role_unrestricted" ON usuarios;
    DROP POLICY IF EXISTS "Usuarios: Ver de sucursal" ON usuarios;
    DROP POLICY IF EXISTS "Usuarios: Modificar solo admins" ON usuarios;
    DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio perfil" ON usuarios;
    DROP POLICY IF EXISTS "Lectura global usuarios autenticados" ON usuarios;
    DROP POLICY IF EXISTS "Service role puede todo en usuarios" ON usuarios;
    DROP POLICY IF EXISTS "Lectura usuarios por sucursal" ON usuarios;
    DROP POLICY IF EXISTS "update_usuarios" ON usuarios;
    DROP POLICY IF EXISTS "insert_usuarios" ON usuarios;
    DROP POLICY IF EXISTS "delete_usuarios" ON usuarios;
    
    -- Crear política de lectura para autenticados (restringida a su sucursal o super_admin)
    CREATE POLICY "lectura_autenticados" 
    ON usuarios FOR SELECT 
    TO authenticated 
    USING (
        id = auth.uid() OR 
        sucursal_id = get_user_sucursal_id() OR 
        is_super_admin()
    );

    -- Permitir que un usuario se actualice a sí mismo o que lo haga un admin
    CREATE POLICY "update_usuarios" 
    ON usuarios FOR UPDATE 
    TO authenticated 
    USING (auth.uid() = id OR is_sucursal_admin())
    WITH CHECK (auth.uid() = id OR is_sucursal_admin());

    -- Permitir que solo admins puedan insertar
    CREATE POLICY "insert_usuarios" 
    ON usuarios FOR INSERT 
    TO authenticated 
    WITH CHECK (is_sucursal_admin());

    -- Permitir que solo admins puedan eliminar
    CREATE POLICY "delete_usuarios" 
    ON usuarios FOR DELETE 
    TO authenticated 
    USING (is_sucursal_admin());

    -- Asegurar que el service role pueda todo (para funciones de backend y webhooks)
    CREATE POLICY "service_role_unrestricted" 
    ON usuarios FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);

END $$;

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
