-- 021_pedidosya_acciones.sql
CREATE TABLE IF NOT EXISTS pedidosya_acciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
    producto_id UUID REFERENCES productos(id) ON DELETE SET NULL,
    id_py TEXT NOT NULL,
    tipo_accion TEXT NOT NULL,
    datos JSONB NOT NULL DEFAULT '{}'::jsonb,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    mensaje_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pedidosya_acciones_pendientes 
ON pedidosya_acciones(sucursal_id, estado);

ALTER TABLE pedidosya_acciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pedidosya_acciones_policy" ON pedidosya_acciones;
CREATE POLICY "pedidosya_acciones_policy" ON pedidosya_acciones FOR ALL USING (true) WITH CHECK (true);
