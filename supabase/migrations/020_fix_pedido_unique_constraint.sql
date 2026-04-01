-- ============================================
-- FIX: PEDIDO UNIQUE CONSTRAINT AND REALTIME
-- ============================================

-- 1. Relax the unique constraint on numero_pedido to be per sucursal
DO $$ 
BEGIN 
    -- Drop the existing global unique constraint if it exists
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedidos_numero_pedido_key') THEN
        ALTER TABLE pedidos DROP CONSTRAINT pedidos_numero_pedido_key;
    END IF;
END $$;

-- Add the new composite unique constraint (sucursal_id + numero_pedido)
-- This allows different sucursales to have the same order sequence (e.g. DELIVERY-001)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedidos_sucursal_numero_unique') THEN
        ALTER TABLE pedidos ADD CONSTRAINT pedidos_sucursal_numero_unique UNIQUE (sucursal_id, numero_pedido);
    END IF;
END $$;

-- 2. Ensure Realtime is enabled for the pedidos table
-- This helps resolve the CHANNEL_ERROR by ensuring the table is in the publication
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pedidos') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;
        END IF;
    END IF;
END $$;
