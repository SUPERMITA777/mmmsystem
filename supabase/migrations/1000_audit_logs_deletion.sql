-- Create logs_eliminacion_pedidos table for auditing
CREATE TABLE IF NOT EXISTS logs_eliminacion_pedidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
    pedido_id UUID REFERENCES pedidos(id) ON DELETE CASCADE,
    producto_nombre TEXT NOT NULL,
    cantidad INTEGER NOT NULL,
    motivo TEXT NOT NULL,
    usuario_id UUID REFERENCES auth.users(id),
    usuario_nombre TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE logs_eliminacion_pedidos ENABLE ROW LEVEL SECURITY;

-- Add RLS policy (only admins of the sucursal can see/insert)
CREATE POLICY "Admins can manage logs of their sucursal"
ON logs_eliminacion_pedidos
FOR ALL
TO authenticated
USING (sucursal_id IN (SELECT sucursal_id FROM usuarios WHERE id = auth.uid()))
WITH CHECK (sucursal_id IN (SELECT sucursal_id FROM usuarios WHERE id = auth.uid()));

-- Refresh schema
NOTIFY pgrst, 'reload schema';
