-- ==========================================================
-- Migration 037: Precios Promocionales Temporales en Productos
-- ==========================================================

ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_promocional NUMERIC(12,2);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS promo_activo BOOLEAN DEFAULT FALSE;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS promo_desde DATE;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS promo_hasta DATE;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS promo_hora_desde TIME;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS promo_hora_hasta TIME;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS promo_dias INTEGER[] DEFAULT '{0,1,2,3,4,5,6}'::INTEGER[];

CREATE INDEX IF NOT EXISTS idx_productos_promo_activo ON productos(promo_activo) WHERE promo_activo = TRUE;
