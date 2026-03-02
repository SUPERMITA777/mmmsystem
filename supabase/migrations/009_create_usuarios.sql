-- ============================================
-- MMM SYSTEM - Create usuarios table
-- Run this in the Supabase SQL Editor
-- ============================================

-- Usuarios del sistema (extiende auth.users de Supabase)
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nombre TEXT NOT NULL,
  apellido TEXT,
  telefono TEXT,
  avatar_url TEXT,
  rol TEXT NOT NULL DEFAULT 'empleado',
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE SET NULL,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para updated_at
DO $$ BEGIN
    CREATE TRIGGER update_usuarios_updated_at
        BEFORE UPDATE ON usuarios
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS policies
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Permitir lectura a usuarios autenticados
CREATE POLICY IF NOT EXISTS "Usuarios pueden ver todos los usuarios"
ON usuarios FOR SELECT
TO authenticated
USING (true);

-- Permitir update solo al propio usuario o admin
CREATE POLICY IF NOT EXISTS "Usuarios pueden actualizar su propio perfil"
ON usuarios FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Permitir insert solo a service_role (para el setup)
CREATE POLICY IF NOT EXISTS "Service role puede insertar usuarios"
ON usuarios FOR INSERT
TO service_role
WITH CHECK (true);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
