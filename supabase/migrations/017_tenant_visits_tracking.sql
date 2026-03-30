-- migration file 017_tenant_visits_tracking.sql

-- Añadir columnas de visitas a sucursales
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS visitas_total BIGINT DEFAULT 0;
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS visitas_hoy BIGINT DEFAULT 0;

-- Función para incrementar visitas (evita race conditions y permite ejecución desde el cliente)
CREATE OR REPLACE FUNCTION increment_sucursal_visits(s_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE sucursales
    SET visitas_total = visitas_total + 1,
        visitas_hoy = visitas_hoy + 1
    WHERE id = s_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Nota: Deberías configurar un CRON job o edge function para resetear visitas_hoy a las 00:00 cada día.
-- Por ahora, el acumulador servirá para los reportes básicos.
