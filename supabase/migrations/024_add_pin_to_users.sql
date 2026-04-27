-- Agregar columna PIN a la tabla de usuarios si no existe
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS pin TEXT;

-- Asegurar que la tabla esté en la publicación de realtime (solo si no está ya)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'usuarios'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE usuarios;
    END IF;
END $$;
