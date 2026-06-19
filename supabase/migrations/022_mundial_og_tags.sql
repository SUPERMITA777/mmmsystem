-- Migración para agregar configuración SEO / OpenGraph a la sucursal para el Mundial

ALTER TABLE sucursales
ADD COLUMN IF NOT EXISTS mundial_og_title VARCHAR(255),
ADD COLUMN IF NOT EXISTS mundial_og_description TEXT;
