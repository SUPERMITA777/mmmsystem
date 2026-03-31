-- migration file 019_analytics_hourly.sql

-- 1. Vaciar tabla actual porque los unique constraints van a chocar
TRUNCATE TABLE analytics_visitas;

-- 2. Añadir columna 'hora' a la tabla analytics_visitas
ALTER TABLE analytics_visitas ADD COLUMN hora INTEGER NOT NULL DEFAULT 0;

-- 3. Descartar la antigua restricción única
ALTER TABLE analytics_visitas DROP CONSTRAINT analytics_visitas_sucursal_id_fecha_key;

-- 4. Recrear restricción única pero incluyendo 'hora'
ALTER TABLE analytics_visitas ADD CONSTRAINT analytics_visitas_unique_hora UNIQUE(sucursal_id, fecha, hora);

-- 5. Actualizar la función para incluir la hora al hacer upsert
CREATE OR REPLACE FUNCTION increment_sucursal_visits(s_id UUID)
RETURNS void AS $$
DECLARE
    v_hora INTEGER;
BEGIN
    -- Capturar hora actual en UTC-3 (Argentina)
    v_hora := EXTRACT(HOUR FROM (CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires'))::INTEGER;

    -- Incrementar histórico total en la tabla sucursales
    UPDATE sucursales 
    SET visitas_total = visitas_total + 1,
        visitas_hoy = visitas_hoy + 1
    WHERE id = s_id;
    
    -- Upsert (Insert o Update) en la tabla horaria de analíticas
    INSERT INTO analytics_visitas (sucursal_id, fecha, hora, cantidad)
    VALUES (s_id, CURRENT_DATE, v_hora, 1)
    ON CONFLICT ON CONSTRAINT analytics_visitas_unique_hora
    DO UPDATE SET cantidad = analytics_visitas.cantidad + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
