-- ============================================
-- FIX: REALTIME PERMISSIONS AND REPLICA IDENTITY
-- ============================================

-- 1. Set Replica Identity to FULL for filtered Realtime
-- This is MANDATORY when using .filter('sucursal_id=eq.', id) in Supabase Realtime
ALTER TABLE pedidos REPLICA IDENTITY FULL;
ALTER TABLE config_sucursal REPLICA IDENTITY FULL;

-- 2. Ensure RLS is robust for Realtime subscriptions
-- Existing policies may fail during WebSocket handshake if they rely on complex joins
-- We'll explicitly define the TO authenticated role for orders

DO $$
BEGIN
    DROP POLICY IF EXISTS "Pedidos: Ver de sucursal" ON pedidos;
    CREATE POLICY "Pedidos: Ver de sucursal" 
    ON pedidos FOR SELECT 
    TO authenticated 
    USING (
      is_super_admin() OR 
      sucursal_id = get_user_sucursal_id()
    );
END $$;

-- 3. Ensure Config Sucursal also allows robust Realtime subscriptions
DO $$
BEGIN
    DROP POLICY IF EXISTS "Config_sucursal: Ver de sucursal" ON config_sucursal;
    CREATE POLICY "Config_sucursal: Ver de sucursal" 
    ON config_sucursal FOR SELECT 
    TO authenticated 
    USING (
      is_super_admin() OR 
      sucursal_id = get_user_sucursal_id()
    );
END $$;

-- 4. Enable Realtime for the required tables (Safety check if not already member)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pedidos') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'config_sucursal') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE config_sucursal;
        END IF;
    END IF;
END $$;
