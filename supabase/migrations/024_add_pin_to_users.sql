-- Agregar columna PIN a la tabla de usuarios si no existe
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS pin TEXT;

-- Asegurar que la tabla esté en la publicación de realtime (opcional pero recomendado)
ALTER PUBLICATION supabase_realtime ADD TABLE usuarios;
