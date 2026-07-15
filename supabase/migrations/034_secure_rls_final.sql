-- ==========================================================
-- Migration 034: Secure remaining public tables using RLS
-- ==========================================================

-- 1. DROP old conflicting policies if any exist
DROP POLICY IF EXISTS "ai_command_log_admin_policy" ON ai_command_log;
DROP POLICY IF EXISTS "analytics_visitas_admin_policy" ON analytics_visitas;
DROP POLICY IF EXISTS "cajas_admin_policy" ON cajas;
DROP POLICY IF EXISTS "categorias_public_select" ON categorias;
DROP POLICY IF EXISTS "Categorias: Ver activas públicamente" ON categorias;
DROP POLICY IF EXISTS "categorias_admin_all" ON categorias;
DROP POLICY IF EXISTS "Categorias: Modificar usuarios de sucursal" ON categorias;
DROP POLICY IF EXISTS "clientes_public_insert" ON clientes;
DROP POLICY IF EXISTS "clientes_public_select" ON clientes;
DROP POLICY IF EXISTS "clientes_admin_all" ON clientes;
DROP POLICY IF EXISTS "Clientes: Ver de sucursal" ON clientes;
DROP POLICY IF EXISTS "Clientes: Modificar usuarios de sucursal" ON clientes;
DROP POLICY IF EXISTS "config_impresion_admin_policy" ON config_impresion;
DROP POLICY IF EXISTS "config_sucursal_public_select" ON config_sucursal;
DROP POLICY IF EXISTS "Config_sucursal: Ver de sucursal" ON config_sucursal;
DROP POLICY IF EXISTS "config_sucursal_admin_all" ON config_sucursal;
DROP POLICY IF EXISTS "Config_sucursal: Modificar solo admins" ON config_sucursal;
DROP POLICY IF EXISTS "descuentos_public_select" ON descuentos;
DROP POLICY IF EXISTS "Descuentos: Ver activos de sucursal" ON descuentos;
DROP POLICY IF EXISTS "descuentos_admin_all" ON descuentos;
DROP POLICY IF EXISTS "horarios_sucursal_public_select" ON horarios_sucursal;
DROP POLICY IF EXISTS "Horarios_sucursal: Ver de sucursal" ON horarios_sucursal;
DROP POLICY IF EXISTS "horarios_sucursal_admin_all" ON horarios_sucursal;
DROP POLICY IF EXISTS "Horarios_sucursal: Modificar solo admins" ON horarios_sucursal;
DROP POLICY IF EXISTS "ingredientes_auth_policy" ON ingredientes;
DROP POLICY IF EXISTS "Ingredientes: Ver de sucursal" ON ingredientes;
DROP POLICY IF EXISTS "Ingredientes: Modificar de sucursal" ON ingredientes;
DROP POLICY IF EXISTS "Ingredientes: Ver todos" ON ingredientes;
DROP POLICY IF EXISTS "Ingredientes: Modificar usuarios autenticados" ON ingredientes;
DROP POLICY IF EXISTS "mesas_public_select" ON mesas;
DROP POLICY IF EXISTS "Mesas: Ver de sucursal" ON mesas;
DROP POLICY IF EXISTS "mesas_admin_all" ON mesas;
DROP POLICY IF EXISTS "Mesas: Modificar usuarios de sucursal" ON mesas;
DROP POLICY IF EXISTS "metodos_pago_public_select" ON metodos_pago;
DROP POLICY IF EXISTS "Metodos_pago: Ver de sucursal" ON metodos_pago;
DROP POLICY IF EXISTS "metodos_pago_admin_all" ON metodos_pago;
DROP POLICY IF EXISTS "Metodos_pago: Modificar usuarios de sucursal" ON metodos_pago;
DROP POLICY IF EXISTS "movimientos_stock_auth_policy" ON movimientos_stock;
DROP POLICY IF EXISTS "Movimientos_stock: Ver de sucursal" ON movimientos_stock;
DROP POLICY IF EXISTS "Movimientos_stock: Crear de sucursal" ON movimientos_stock;
DROP POLICY IF EXISTS "Movimientos_stock: Ver usuarios autenticados" ON movimientos_stock;
DROP POLICY IF EXISTS "Movimientos_stock: Crear usuarios autenticados" ON movimientos_stock;
DROP POLICY IF EXISTS "pedido_items_public_insert" ON pedido_items;
DROP POLICY IF EXISTS "pedido_items_public_all" ON pedido_items;
DROP POLICY IF EXISTS "pedido_items_select" ON pedido_items;
DROP POLICY IF EXISTS "pedido_items_admin_all" ON pedido_items;
DROP POLICY IF EXISTS "Pedido_items: Ver de sucursal" ON pedido_items;
DROP POLICY IF EXISTS "Pedido_items: Modificar con pedido" ON pedido_items;
DROP POLICY IF EXISTS "pedidos_public_insert" ON pedidos;
DROP POLICY IF EXISTS "pedidos_public_update" ON pedidos;
DROP POLICY IF EXISTS "pedidos_admin_all" ON pedidos;
DROP POLICY IF EXISTS "Pedidos: Ver de sucursal" ON pedidos;
DROP POLICY IF EXISTS "Pedidos: Crear usuarios autenticados" ON pedidos;
DROP POLICY IF EXISTS "Pedidos: Modificar usuarios de sucursal" ON pedidos;
DROP POLICY IF EXISTS "producto_grupos_adicionales_public_select" ON producto_grupos_adicionales;
DROP POLICY IF EXISTS "producto_grupos_adicionales_admin_all" ON producto_grupos_adicionales;
DROP POLICY IF EXISTS "productos_public_select" ON productos;
DROP POLICY IF EXISTS "Productos: Ver activos públicamente" ON productos;
DROP POLICY IF EXISTS "productos_admin_all" ON productos;
DROP POLICY IF EXISTS "Productos: Ver todos si es usuario" ON productos;
DROP POLICY IF EXISTS "Productos: Modificar usuarios de sucursal" ON productos;
DROP POLICY IF EXISTS "repartidores_admin_policy" ON repartidores;
DROP POLICY IF EXISTS "sucursales_public_select" ON sucursales;
DROP POLICY IF EXISTS "sucursales_admin_all" ON sucursales;
DROP POLICY IF EXISTS "Sucursales: Ver todas" ON sucursales;
DROP POLICY IF EXISTS "Sucursales: Modificar solo admins" ON sucursales;
DROP POLICY IF EXISTS "transacciones_caja_admin_policy" ON transacciones_caja;
DROP POLICY IF EXISTS "user_roles_select" ON user_roles;
DROP POLICY IF EXISTS "user_roles_write" ON user_roles;
DROP POLICY IF EXISTS "zonas_entrega_public_select" ON zonas_entrega;
DROP POLICY IF EXISTS "Zonas_entrega: Ver de sucursal" ON zonas_entrega;
DROP POLICY IF EXISTS "zonas_entrega_admin_all" ON zonas_entrega;
DROP POLICY IF EXISTS "Zonas_entrega: Modificar usuarios de sucursal" ON zonas_entrega;

-- 2. ENABLE Row Level Security on the 22 tables
ALTER TABLE ai_command_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_visitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cajas ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_impresion ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_sucursal ENABLE ROW LEVEL SECURITY;
ALTER TABLE descuentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE horarios_sucursal ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE metodos_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE producto_grupos_adicionales ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE repartidores ENABLE ROW LEVEL SECURITY;
ALTER TABLE sucursales ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacciones_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE zonas_entrega ENABLE ROW LEVEL SECURITY;

-- 3. CREATE the secure policies

-- AI Command Log
CREATE POLICY "ai_command_log_admin_policy" ON ai_command_log
  FOR ALL TO authenticated
  USING (is_super_admin() OR sucursal_id = get_user_sucursal_id())
  WITH CHECK (is_super_admin() OR sucursal_id = get_user_sucursal_id());

-- Analytics Visitas
CREATE POLICY "analytics_visitas_admin_policy" ON analytics_visitas
  FOR ALL TO authenticated
  USING (is_super_admin() OR sucursal_id = get_user_sucursal_id())
  WITH CHECK (is_super_admin() OR sucursal_id = get_user_sucursal_id());

-- Cajas
CREATE POLICY "cajas_admin_policy" ON cajas
  FOR ALL TO authenticated
  USING (is_super_admin() OR sucursal_id = get_user_sucursal_id())
  WITH CHECK (is_super_admin() OR sucursal_id = get_user_sucursal_id());

-- Categorias
CREATE POLICY "categorias_public_select" ON categorias
  FOR SELECT
  USING (activo = TRUE OR is_super_admin() OR sucursal_id = get_user_sucursal_id());

CREATE POLICY "categorias_admin_all" ON categorias
  FOR ALL TO authenticated
  USING (is_super_admin() OR sucursal_id = get_user_sucursal_id())
  WITH CHECK (is_super_admin() OR sucursal_id = get_user_sucursal_id());

-- Clientes
CREATE POLICY "clientes_public_insert" ON clientes
  FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "clientes_public_select" ON clientes
  FOR SELECT
  USING (TRUE);

CREATE POLICY "clientes_admin_all" ON clientes
  FOR ALL TO authenticated
  USING (is_super_admin() OR sucursal_id = get_user_sucursal_id())
  WITH CHECK (is_super_admin() OR sucursal_id = get_user_sucursal_id());

-- Config Impresion
CREATE POLICY "config_impresion_admin_policy" ON config_impresion
  FOR ALL TO authenticated
  USING (is_super_admin() OR sucursal_id = get_user_sucursal_id())
  WITH CHECK (is_super_admin() OR sucursal_id = get_user_sucursal_id());

-- Config Sucursal
CREATE POLICY "config_sucursal_public_select" ON config_sucursal
  FOR SELECT
  USING (TRUE);

CREATE POLICY "config_sucursal_admin_all" ON config_sucursal
  FOR ALL TO authenticated
  USING (is_super_admin() OR sucursal_id = get_user_sucursal_id())
  WITH CHECK (is_super_admin() OR sucursal_id = get_user_sucursal_id());

-- Descuentos
CREATE POLICY "descuentos_public_select" ON descuentos
  FOR SELECT
  USING (activo = TRUE OR is_super_admin() OR sucursal_id = get_user_sucursal_id());

CREATE POLICY "descuentos_admin_all" ON descuentos
  FOR ALL TO authenticated
  USING (is_super_admin() OR sucursal_id = get_user_sucursal_id())
  WITH CHECK (is_super_admin() OR sucursal_id = get_user_sucursal_id());

-- Horarios Sucursal
CREATE POLICY "horarios_sucursal_public_select" ON horarios_sucursal
  FOR SELECT
  USING (TRUE);

CREATE POLICY "horarios_sucursal_admin_all" ON horarios_sucursal
  FOR ALL TO authenticated
  USING (is_super_admin() OR sucursal_id = get_user_sucursal_id())
  WITH CHECK (is_super_admin() OR sucursal_id = get_user_sucursal_id());

-- Ingredientes
CREATE POLICY "ingredientes_auth_policy" ON ingredientes
  FOR ALL TO authenticated
  USING (is_super_admin() OR sucursal_id = get_user_sucursal_id())
  WITH CHECK (is_super_admin() OR sucursal_id = get_user_sucursal_id());

-- Mesas
CREATE POLICY "mesas_public_select" ON mesas
  FOR SELECT
  USING (TRUE);

CREATE POLICY "mesas_admin_all" ON mesas
  FOR ALL TO authenticated
  USING (is_super_admin() OR sucursal_id = get_user_sucursal_id())
  WITH CHECK (is_super_admin() OR sucursal_id = get_user_sucursal_id());

-- Metodos Pago
CREATE POLICY "metodos_pago_public_select" ON metodos_pago
  FOR SELECT
  USING (activo = TRUE OR is_super_admin() OR sucursal_id = get_user_sucursal_id());

CREATE POLICY "metodos_pago_admin_all" ON metodos_pago
  FOR ALL TO authenticated
  USING (is_super_admin() OR sucursal_id = get_user_sucursal_id())
  WITH CHECK (is_super_admin() OR sucursal_id = get_user_sucursal_id());

-- Movimientos Stock
CREATE POLICY "movimientos_stock_auth_policy" ON movimientos_stock
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR 
    EXISTS (
      SELECT 1 FROM ingredientes i 
      WHERE i.id = movimientos_stock.ingrediente_id 
      AND i.sucursal_id = get_user_sucursal_id()
    )
  )
  WITH CHECK (
    is_super_admin() OR 
    EXISTS (
      SELECT 1 FROM ingredientes i 
      WHERE i.id = movimientos_stock.ingrediente_id 
      AND i.sucursal_id = get_user_sucursal_id()
    )
  );

-- Pedido Items
CREATE POLICY "pedido_items_public_insert" ON pedido_items
  FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "pedido_items_select" ON pedido_items
  FOR SELECT
  USING (TRUE);

CREATE POLICY "pedido_items_admin_all" ON pedido_items
  FOR ALL
  USING (
    is_super_admin() OR 
    EXISTS (
      SELECT 1 FROM pedidos p
      WHERE p.id = pedido_items.pedido_id
      AND p.sucursal_id = get_user_sucursal_id()
    )
  );

-- Pedidos
CREATE POLICY "pedidos_public_insert" ON pedidos
  FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "pedidos_public_update" ON pedidos
  FOR UPDATE
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "pedidos_admin_all" ON pedidos
  FOR ALL
  USING (
    is_super_admin() OR 
    sucursal_id = get_user_sucursal_id()
  );

-- Producto Grupos Adicionales
CREATE POLICY "producto_grupos_adicionales_public_select" ON producto_grupos_adicionales
  FOR SELECT
  USING (TRUE);

CREATE POLICY "producto_grupos_adicionales_admin_all" ON producto_grupos_adicionales
  FOR ALL TO authenticated
  USING (is_super_admin() OR sucursal_id = get_user_sucursal_id())
  WITH CHECK (is_super_admin() OR sucursal_id = get_user_sucursal_id());

-- Productos
CREATE POLICY "productos_public_select" ON productos
  FOR SELECT
  USING (activo = TRUE OR is_super_admin() OR sucursal_id = get_user_sucursal_id());

CREATE POLICY "productos_admin_all" ON productos
  FOR ALL TO authenticated
  USING (is_super_admin() OR sucursal_id = get_user_sucursal_id())
  WITH CHECK (is_super_admin() OR sucursal_id = get_user_sucursal_id());

-- Repartidores
CREATE POLICY "repartidores_admin_policy" ON repartidores
  FOR ALL TO authenticated
  USING (is_super_admin() OR sucursal_id = get_user_sucursal_id())
  WITH CHECK (is_super_admin() OR sucursal_id = get_user_sucursal_id());

-- Sucursales
CREATE POLICY "sucursales_public_select" ON sucursales
  FOR SELECT
  USING (TRUE);

CREATE POLICY "sucursales_admin_all" ON sucursales
  FOR ALL TO authenticated
  USING (is_super_admin() OR id = get_user_sucursal_id())
  WITH CHECK (is_super_admin() OR id = get_user_sucursal_id());

-- Transacciones Caja
CREATE POLICY "transacciones_caja_admin_policy" ON transacciones_caja
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR 
    EXISTS (
      SELECT 1 FROM cajas c 
      WHERE c.id = transacciones_caja.caja_id 
      AND c.sucursal_id = get_user_sucursal_id()
    )
  )
  WITH CHECK (
    is_super_admin() OR 
    EXISTS (
      SELECT 1 FROM cajas c 
      WHERE c.id = transacciones_caja.caja_id 
      AND c.sucursal_id = get_user_sucursal_id()
    )
  );

-- User Roles
CREATE POLICY "user_roles_select" ON user_roles
  FOR SELECT TO authenticated
  USING (is_super_admin() OR sucursal_id = get_user_sucursal_id());
  
CREATE POLICY "user_roles_write" ON user_roles
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Zonas Entrega
CREATE POLICY "zonas_entrega_public_select" ON zonas_entrega
  FOR SELECT
  USING (activo = TRUE OR is_super_admin() OR sucursal_id = get_user_sucursal_id());

CREATE POLICY "zonas_entrega_admin_all" ON zonas_entrega
  FOR ALL TO authenticated
  USING (is_super_admin() OR sucursal_id = get_user_sucursal_id())
  WITH CHECK (is_super_admin() OR sucursal_id = get_user_sucursal_id());

-- 4. Reload PostgREST schema cache to apply changes immediately
NOTIFY pgrst, 'reload schema';
