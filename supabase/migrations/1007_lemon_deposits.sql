-- Migration: Lemon Cash integration

-- 1. Agregar columna pago_confirmado a la tabla pedidos
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pago_confirmado BOOLEAN DEFAULT FALSE;

-- 2. Crear tabla de depósitos de Lemon Cash
CREATE TABLE IF NOT EXISTS lemon_deposits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  monto NUMERIC(12,2) NOT NULL,
  emisor TEXT,
  texto_notificacion TEXT,
  pedido_id UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  estado TEXT DEFAULT 'pendiente', -- 'pendiente', 'asociado'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Habilitar RLS en lemon_deposits
ALTER TABLE lemon_deposits ENABLE ROW LEVEL SECURITY;

-- 4. Crear políticas RLS para lemon_deposits
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "lemon_deposits: Ver de sucursal" ON lemon_deposits;
  CREATE POLICY "lemon_deposits: Ver de sucursal"
    ON lemon_deposits FOR SELECT
    USING (
      is_super_admin() OR 
      sucursal_id = get_user_sucursal_id()
    );

  DROP POLICY IF EXISTS "lemon_deposits: Modificar de sucursal" ON lemon_deposits;
  CREATE POLICY "lemon_deposits: Modificar de sucursal"
    ON lemon_deposits FOR ALL
    USING (
      is_super_admin() OR 
      sucursal_id = get_user_sucursal_id()
    );
END $$;

-- 5. Habilitar Realtime para lemon_deposits
ALTER TABLE lemon_deposits REPLICA IDENTITY FULL;

DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'lemon_deposits') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE lemon_deposits;
        END IF;
    END IF;
END $$;
