-- Migración para Integración del Módulo Mundial en MMMSYSTEM

-- 1. Tabla de Partidos (Global, sin sucursal_id)
CREATE TABLE IF NOT EXISTS mundial_partidos (
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

-- 2. Tabla de Predicciones (Por Sucursal)
CREATE TABLE IF NOT EXISTS mundial_predicciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    partido_id UUID NOT NULL REFERENCES mundial_partidos(id) ON DELETE CASCADE,
    nombre_cliente VARCHAR(100) NOT NULL,
    whatsapp VARCHAR(20) NOT NULL,
    prediccion_local INT NOT NULL,
    prediccion_visitante INT NOT NULL,
    codigo_alfanumerico VARCHAR(20) NOT NULL,
    whatsapp_enviado BOOLEAN DEFAULT false,
    fecha_creacion TIMESTAMPTZ DEFAULT now(),
    es_acierto_exacto BOOLEAN DEFAULT false,
    es_acierto_parcial BOOLEAN DEFAULT false,
    puntos_obtenidos INT DEFAULT 0,
    premio_canjeado BOOLEAN DEFAULT false,
    fecha_canje TIMESTAMPTZ DEFAULT NULL,
    
    -- Constraint: Un mismo número de WhatsApp solo puede tener UNA predicción por partido, por sucursal
    CONSTRAINT uq_mundial_partido_whatsapp_sucursal UNIQUE (sucursal_id, partido_id, whatsapp),
    CONSTRAINT uq_mundial_codigo_sucursal UNIQUE (sucursal_id, codigo_alfanumerico)
);

-- Trigger para rechazar predicciones después de la hora del partido
CREATE OR REPLACE FUNCTION check_mundial_prediccion_fecha_hora()
RETURNS TRIGGER AS $$
DECLARE
    partido_fecha_hora TIMESTAMPTZ;
BEGIN
    SELECT fecha_hora INTO partido_fecha_hora FROM mundial_partidos WHERE id = NEW.partido_id;
    
    IF now() >= partido_fecha_hora THEN
        RAISE EXCEPTION 'No se pueden hacer ni modificar predicciones después del inicio del partido.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_mundial_prediccion_fecha_hora_trigger
BEFORE INSERT OR UPDATE ON mundial_predicciones
FOR EACH ROW
EXECUTE FUNCTION check_mundial_prediccion_fecha_hora();


-- 3. Tabla de Premios (Diarios por Sucursal)
CREATE TABLE IF NOT EXISTS mundial_premios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    fecha DATE NOT NULL, -- Premio asociado a un día específico
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    tipo_acierto_requerido VARCHAR(20) DEFAULT 'exacto' CHECK (tipo_acierto_requerido IN ('exacto', 'parcial', 'cualquiera')),
    stock_disponible INT DEFAULT NULL, -- NULL significa infinito
    creado_en TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_mundial_premio_fecha_sucursal UNIQUE (sucursal_id, fecha)
);

-- 4. Tabla de Banners (Por Sucursal)
CREATE TABLE IF NOT EXISTS mundial_banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    nombre_anunciante VARCHAR(100) NOT NULL,
    imagen_url TEXT NOT NULL,
    link_destino TEXT,
    texto_alt VARCHAR(150),
    activo BOOLEAN DEFAULT true,
    peso INT DEFAULT 1,
    fecha_creacion TIMESTAMPTZ DEFAULT now()
);

-- 5. Tabla de Configuración (clave-valor, Por Sucursal)
CREATE TABLE IF NOT EXISTS mundial_configuracion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    clave VARCHAR(50) NOT NULL,
    valor JSONB NOT NULL,
    descripcion TEXT,
    actualizado_en TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_mundial_config_clave_sucursal UNIQUE (sucursal_id, clave)
);

-- Function to initialize default config for a sucursal
CREATE OR REPLACE FUNCTION init_mundial_config_for_sucursal(p_sucursal_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO mundial_configuracion (sucursal_id, clave, valor, descripcion) VALUES
    (p_sucursal_id, 'puntos_acierto_exacto', '3', 'Puntos otorgados por adivinar el resultado exacto'),
    (p_sucursal_id, 'puntos_acierto_parcial', '1', 'Puntos otorgados por adivinar el ganador o empate sin marcador exacto'),
    (p_sucursal_id, 'frecuencia_sync_minutos', '10', 'Minutos entre cada sincronización automática de partidos')
    ON CONFLICT (sucursal_id, clave) DO NOTHING;
END;
$$ LANGUAGE plpgsql;


-- 6. Tabla de Auditoría de Predicciones
CREATE TABLE IF NOT EXISTS mundial_predicciones_auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    prediccion_id UUID NOT NULL REFERENCES mundial_predicciones(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL, -- The user ID who made the change
    admin_email VARCHAR(255),
    campo_modificado VARCHAR(50) NOT NULL,
    valor_anterior TEXT,
    valor_nuevo TEXT,
    fecha_modificacion TIMESTAMPTZ DEFAULT now()
);

-- 7. Policies (RLS)
ALTER TABLE mundial_partidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE mundial_predicciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE mundial_premios ENABLE ROW LEVEL SECURITY;
ALTER TABLE mundial_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE mundial_configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE mundial_predicciones_auditoria ENABLE ROW LEVEL SECURITY;

-- mundial_partidos: everyone can read, only service_role can write (or explicit admin function)
CREATE POLICY "Mundial Partidos: Public Read" ON mundial_partidos FOR SELECT USING (true);

-- mundial_banners: public read, tenant write
CREATE POLICY "Mundial Banners: Public Read" ON mundial_banners FOR SELECT USING (true);

-- mundial_premios: public read, tenant write
CREATE POLICY "Mundial Premios: Public Read" ON mundial_premios FOR SELECT USING (true);

-- mundial_predicciones: public read (for rankings), tenant write/update
CREATE POLICY "Mundial Predicciones: Public Read" ON mundial_predicciones FOR SELECT USING (true);

-- mundial_configuracion: public read (for points config), tenant write
CREATE POLICY "Mundial Config: Public Read" ON mundial_configuracion FOR SELECT USING (true);
