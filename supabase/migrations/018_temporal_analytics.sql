-- migration file 018_temporal_analytics.sql

-- Tabla para guardar visitas por local y día
CREATE TABLE IF NOT EXISTS analytics_visitas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
    fecha DATE DEFAULT CURRENT_DATE,
    cantidad BIGINT DEFAULT 1,
    UNIQUE(sucursal_id, fecha)
);

-- Refactorización de la función de incremento para manejar ambos: total y diario
CREATE OR REPLACE FUNCTION increment_sucursal_visits(s_id UUID)
RETURNS void AS $$
BEGIN
    -- 1. Incrementar histórico total en la tabla sucursales
    UPDATE sucursales 
    SET visitas_total = visitas_total + 1,
        visitas_hoy = visitas_hoy + 1
    WHERE id = s_id;
    
    -- 2. Upsert (Insert o Update) en la tabla diaria de analíticas
    INSERT INTO analytics_visitas (sucursal_id, fecha, cantidad)
    VALUES (s_id, CURRENT_DATE, 1)
    ON CONFLICT (sucursal_id, fecha)
    DO UPDATE SET cantidad = analytics_visitas.cantidad + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Índice para mejorar las consultas por período
CREATE INDEX IF NOT EXISTS idx_analytics_visitas_fecha ON analytics_visitas(fecha);
CREATE INDEX IF NOT EXISTS idx_analytics_visitas_sucursal ON analytics_visitas(sucursal_id);
