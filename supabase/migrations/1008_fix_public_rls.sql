-- Allow public select on pedidos (needed for client order tracking and select returning inserts)
DROP POLICY IF EXISTS "pedidos_public_select" ON pedidos;
CREATE POLICY "pedidos_public_select" ON pedidos
  FOR SELECT
  USING (TRUE);

-- Allow public update on clientes (needed when returning customers place a new order)
DROP POLICY IF EXISTS "clientes_public_update" ON clientes;
CREATE POLICY "clientes_public_update" ON clientes
  FOR UPDATE
  USING (TRUE)
  WITH CHECK (TRUE);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
