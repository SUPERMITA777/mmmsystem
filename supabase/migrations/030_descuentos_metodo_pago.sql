-- Migration to add payment method and auto-apply fields to descuentos
ALTER TABLE descuentos ADD COLUMN metodo_pago_id UUID REFERENCES metodos_pago(id) ON DELETE SET NULL;
ALTER TABLE descuentos ADD COLUMN auto_aplicar BOOLEAN DEFAULT FALSE;
