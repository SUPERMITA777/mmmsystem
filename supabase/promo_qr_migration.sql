-- ============================================================
-- PROMO QR — Migración de tablas en Supabase
-- Ejecutar en el SQL Editor de tu proyecto de Supabase
-- ============================================================

-- 1. Tabla de configuración de la promo (una por sucursal)
CREATE TABLE IF NOT EXISTS promo_qr_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sucursal_id uuid REFERENCES sucursales(id) ON DELETE CASCADE,
  activo boolean DEFAULT false,
  premios jsonb NOT NULL DEFAULT '[]',
  -- formato de premios:
  -- [{"id":"uuid","nombre":"10% OFF","tipo":"porcentaje","valor":10,"aplicar_a":"general","peso":20}, ...]
  -- tipos: "porcentaje" | "fijo" | "envio_gratis" | "producto_gratis"
  fecha_vencimiento_codigos date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(sucursal_id)
);

-- 2. Tabla de códigos generados (uno por escaneo de QR)
CREATE TABLE IF NOT EXISTS promo_qr_codigos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sucursal_id uuid REFERENCES sucursales(id) ON DELETE CASCADE,
  pedido_id uuid REFERENCES pedidos(id) ON DELETE SET NULL,
  codigo varchar(4) NOT NULL,
  premio jsonb NOT NULL,
  usado boolean DEFAULT false,
  fecha_uso timestamptz,
  pedido_canje_id uuid REFERENCES pedidos(id) ON DELETE SET NULL,
  fecha_vencimiento date,
  created_at timestamptz DEFAULT now(),
  UNIQUE(sucursal_id, codigo)
);

-- 3. Row Level Security
ALTER TABLE promo_qr_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_qr_codigos ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas (ajustar según tus necesidades de seguridad)
CREATE POLICY "allow_all_promo_config" ON promo_qr_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_promo_codigos" ON promo_qr_codigos FOR ALL USING (true) WITH CHECK (true);

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_promo_qr_codigos_sucursal ON promo_qr_codigos(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_promo_qr_codigos_pedido ON promo_qr_codigos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_promo_qr_codigos_codigo ON promo_qr_codigos(sucursal_id, codigo);
