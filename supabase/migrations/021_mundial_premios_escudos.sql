-- Migración para actualizar escudos y premios del mundial

-- 1. Agregar escudos a los partidos
ALTER TABLE mundial_partidos
ADD COLUMN IF NOT EXISTS escudo_local TEXT,
ADD COLUMN IF NOT EXISTS escudo_visitante TEXT;

-- 2. Modificar la tabla de premios para que se asocie a un partido en lugar de una fecha
-- Borramos la tabla actual y la creamos de nuevo porque vamos a cambiar la estructura
-- (Asumiendo que aún no hay premios reales cargados en producción, de lo contrario habría que hacer una migración más compleja de datos, pero como estamos creando el sistema, es seguro recrear).

DROP TABLE IF EXISTS mundial_premios CASCADE;

CREATE TABLE mundial_premios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    partido_id UUID NOT NULL REFERENCES mundial_partidos(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    tipo_acierto_requerido VARCHAR(20) DEFAULT 'exacto' CHECK (tipo_acierto_requerido IN ('exacto', 'parcial', 'cualquiera')),
    creado_en TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_mundial_premio_partido_sucursal UNIQUE (sucursal_id, partido_id)
);

ALTER TABLE mundial_premios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mundial Premios: Public Read" ON mundial_premios FOR SELECT USING (true);
