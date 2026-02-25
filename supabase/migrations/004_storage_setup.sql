-- ============================================
-- MMM SYSTEM DELIVERY - Configuración de Almacenamiento (Storage)
-- ============================================

-- 1. Crear el bucket 'images' si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Habilitar RLS en la tabla de objetos (si no lo está)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Eliminar políticas existentes para evitar conflictos al re-ejecutar
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;

-- 4. Crear nuevas políticas

-- Permitir acceso público de lectura a los objetos en el bucket 'images'
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'images');

-- Permitir a usuarios autenticados subir archivos al bucket 'images'
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'images' AND auth.role() = 'authenticated');

-- Permitir a usuarios autenticados actualizar sus archivos en el bucket 'images'
CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'images' AND auth.role() = 'authenticated');

-- Permitir a usuarios autenticados eliminar sus archivos en el bucket 'images'
CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'images' AND auth.role() = 'authenticated');
