-- Migración Inicial para Plataforma de Predicciones del Mundial

-- 1. Tabla de Partidos
CREATE TABLE IF NOT EXISTS partidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipo_local VARCHAR(100) NOT NULL,
    equipo_visitante VARCHAR(100) NOT NULL,
    fecha_hora TIMESTAMPTZ NOT NULL,
    resultado_local INT DEFAULT NULL,
    resultado_visitante INT DEFAULT NULL,
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_curso', 'finalizado')),
    fuente_resultado VARCHAR(20) DEFAULT 'api' CHECK (fuente_resultado IN ('api', 'manual')),
    id_externo VARCHAR(100) UNIQUE,
    creado_en TIMESTAMPTZ DEFAULT now(),
    actualizado_en TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabla de Predicciones
CREATE TABLE IF NOT EXISTS predicciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partido_id UUID NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
    nombre_cliente VARCHAR(100) NOT NULL,
    whatsapp VARCHAR(20) NOT NULL,
    prediccion_local INT NOT NULL,
    prediccion_visitante INT NOT NULL,
    codigo_alfanumerico VARCHAR(20) NOT NULL UNIQUE,
    whatsapp_enviado BOOLEAN DEFAULT false,
    fecha_creacion TIMESTAMPTZ DEFAULT now(),
    es_acierto_exacto BOOLEAN DEFAULT false,
    es_acierto_parcial BOOLEAN DEFAULT false,
    puntos_obtenidos INT DEFAULT 0,
    premio_canjeado BOOLEAN DEFAULT false,
    fecha_canje TIMESTAMPTZ DEFAULT NULL,
    
    -- Constraint crítico: Un mismo número de WhatsApp solo puede tener UNA predicción por partido
    CONSTRAINT uq_partido_whatsapp UNIQUE (partido_id, whatsapp)
);

-- Trigger para rechazar predicciones después de la hora del partido
CREATE OR REPLACE FUNCTION check_prediccion_fecha_hora()
RETURNS TRIGGER AS $$
DECLARE
    partido_fecha_hora TIMESTAMPTZ;
BEGIN
    SELECT fecha_hora INTO partido_fecha_hora FROM partidos WHERE id = NEW.partido_id;
    
    IF now() >= partido_fecha_hora THEN
        RAISE EXCEPTION 'No se pueden hacer ni modificar predicciones después del inicio del partido.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_prediccion_fecha_hora_trigger
BEFORE INSERT OR UPDATE ON predicciones
FOR EACH ROW
EXECUTE FUNCTION check_prediccion_fecha_hora();


-- 3. Tabla de Premios (Diarios)
CREATE TABLE IF NOT EXISTS premios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha DATE UNIQUE NOT NULL, -- Premio asociado a un día específico
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    tipo_acierto_requerido VARCHAR(20) DEFAULT 'exacto' CHECK (tipo_acierto_requerido IN ('exacto', 'parcial', 'cualquiera')),
    stock_disponible INT DEFAULT NULL, -- NULL significa infinito
    creado_en TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabla de Banners
CREATE TABLE IF NOT EXISTS banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_anunciante VARCHAR(100) NOT NULL,
    imagen_url TEXT NOT NULL,
    link_destino TEXT,
    texto_alt VARCHAR(150),
    activo BOOLEAN DEFAULT true,
    peso INT DEFAULT 1,
    fecha_creacion TIMESTAMPTZ DEFAULT now()
);

-- 5. Tabla de Configuración (clave-valor)
CREATE TABLE IF NOT EXISTS configuracion (
    clave VARCHAR(50) PRIMARY KEY,
    valor JSONB NOT NULL,
    descripcion TEXT,
    actualizado_en TIMESTAMPTZ DEFAULT now()
);

-- Valores por defecto en configuración
INSERT INTO configuracion (clave, valor, descripcion) VALUES
('puntos_acierto_exacto', '3', 'Puntos otorgados por adivinar el resultado exacto'),
('puntos_acierto_parcial', '1', 'Puntos otorgados por adivinar el ganador o empate sin marcador exacto'),
('frecuencia_sync_minutos', '10', 'Minutos entre cada sincronización automática de partidos')
ON CONFLICT (clave) DO NOTHING;


-- 6. Tabla de Auditoría de Predicciones
CREATE TABLE IF NOT EXISTS predicciones_auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediccion_id UUID NOT NULL REFERENCES predicciones(id) ON DELETE CASCADE,
    campo_modificado VARCHAR(50) NOT NULL,
    valor_anterior TEXT,
    valor_nuevo TEXT,
    fecha TIMESTAMPTZ DEFAULT now(),
    usuario_admin UUID -- Podría apuntar a auth.users de Supabase
);

-- Habilitar RLS (Row Level Security) y definir políticas base
-- Nota: Por defecto, bloqueamos todo el acceso anónimo y definimos permisos explícitos

ALTER TABLE partidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE predicciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE premios ENABLE ROW LEVEL SECURITY;
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE predicciones_auditoria ENABLE ROW LEVEL SECURITY;

-- Políticas para Partidos (Lectura pública, Escritura solo admin/service_role)
CREATE POLICY "Partidos son visibles para todos" ON partidos
    FOR SELECT USING (true);

-- Políticas para Predicciones (Lectura/Escritura anónima controlada)
-- Permite insertar si la fecha de partido es válida (manejado por el trigger también)
CREATE POLICY "Cualquiera puede crear predicciones" ON predicciones
    FOR INSERT WITH CHECK (true);
    
-- La lectura pública de predicciones puede ser necesaria para el ranking (pero ofuscada)
-- En principio permitimos lectura pública, el frontend se encargará de no mostrar datos sensibles
CREATE POLICY "Predicciones son visibles para el ranking" ON predicciones
    FOR SELECT USING (true);

-- Políticas para Banners (Lectura pública de banners activos)
CREATE POLICY "Banners activos son visibles" ON banners
    FOR SELECT USING (activo = true);

-- Políticas para Premios (Lectura pública)
CREATE POLICY "Premios son visibles" ON premios
    FOR SELECT USING (true);

-- Configuración (Lectura pública)
CREATE POLICY "Configuración es visible" ON configuracion
    FOR SELECT USING (true);

-- Funciones para manejar la actualización de timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_partidos
BEFORE UPDATE ON partidos
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_configuracion
BEFORE UPDATE ON configuracion
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
