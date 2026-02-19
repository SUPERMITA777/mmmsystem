-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE sucursales ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE variantes_producto ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE metodos_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE zonas_entrega ENABLE ROW LEVEL SECURITY;
ALTER TABLE repartidores ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE cajas ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacciones_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE descuentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_sucursal ENABLE ROW LEVEL SECURITY;
ALTER TABLE horarios_sucursal ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS BÁSICAS
-- ============================================

-- Función helper para obtener el usuario_id actual
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
  SELECT auth.uid();
$$ LANGUAGE sql STABLE;

-- Función helper para obtener la sucursal del usuario
CREATE OR REPLACE FUNCTION get_user_sucursal_id() RETURNS UUID AS $$
  SELECT sucursal_id FROM usuarios WHERE id = auth.uid();
$$ LANGUAGE sql STABLE;

-- Función helper para verificar si es super_admin
CREATE OR REPLACE FUNCTION is_super_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios 
    WHERE id = auth.uid() AND rol = 'super_admin'
  );
$$ LANGUAGE sql STABLE;

-- Función helper para verificar si es admin de sucursal
CREATE OR REPLACE FUNCTION is_sucursal_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios 
    WHERE id = auth.uid() AND rol IN ('super_admin', 'admin')
  );
$$ LANGUAGE sql STABLE;

-- ============================================
-- POLÍTICAS POR TABLA
-- ============================================

-- SUCURSALES: Todos pueden ver, solo admins pueden modificar
CREATE POLICY "Sucursales: Ver todas"
  ON sucursales FOR SELECT
  USING (TRUE);

CREATE POLICY "Sucursales: Modificar solo admins"
  ON sucursales FOR ALL
  USING (is_sucursal_admin());

-- USUARIOS: Ver usuarios de la misma sucursal o todos si es super_admin
CREATE POLICY "Usuarios: Ver de sucursal"
  ON usuarios FOR SELECT
  USING (
    is_super_admin() OR 
    sucursal_id = get_user_sucursal_id()
  );

CREATE POLICY "Usuarios: Modificar solo admins"
  ON usuarios FOR ALL
  USING (is_sucursal_admin());

-- PRODUCTOS: Ver productos activos públicamente, todos los productos si es usuario
CREATE POLICY "Productos: Ver activos públicamente"
  ON productos FOR SELECT
  USING (activo = TRUE);

CREATE POLICY "Productos: Ver todos si es usuario"
  ON productos FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    (is_super_admin() OR sucursal_id = get_user_sucursal_id())
  );

CREATE POLICY "Productos: Modificar usuarios de sucursal"
  ON productos FOR ALL
  USING (
    is_super_admin() OR 
    sucursal_id = get_user_sucursal_id()
  );

-- CATEGORIAS: Similar a productos
CREATE POLICY "Categorias: Ver activas públicamente"
  ON categorias FOR SELECT
  USING (activo = TRUE);

CREATE POLICY "Categorias: Modificar usuarios de sucursal"
  ON categorias FOR ALL
  USING (
    is_super_admin() OR 
    sucursal_id = get_user_sucursal_id()
  );

-- PEDIDOS: Ver pedidos de la sucursal del usuario
CREATE POLICY "Pedidos: Ver de sucursal"
  ON pedidos FOR SELECT
  USING (
    is_super_admin() OR 
    sucursal_id = get_user_sucursal_id()
  );

CREATE POLICY "Pedidos: Crear usuarios autenticados"
  ON pedidos FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Pedidos: Modificar usuarios de sucursal"
  ON pedidos FOR UPDATE
  USING (
    is_super_admin() OR 
    sucursal_id = get_user_sucursal_id()
  );

-- PEDIDO_ITEMS: Mismas políticas que pedidos
CREATE POLICY "Pedido_items: Ver de sucursal"
  ON pedido_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pedidos p
      WHERE p.id = pedido_items.pedido_id
      AND (is_super_admin() OR p.sucursal_id = get_user_sucursal_id())
    )
  );

CREATE POLICY "Pedido_items: Modificar con pedido"
  ON pedido_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM pedidos p
      WHERE p.id = pedido_items.pedido_id
      AND (is_super_admin() OR p.sucursal_id = get_user_sucursal_id())
    )
  );

-- CLIENTES: Ver y modificar clientes de la sucursal
CREATE POLICY "Clientes: Ver de sucursal"
  ON clientes FOR SELECT
  USING (
    is_super_admin() OR 
    sucursal_id = get_user_sucursal_id()
  );

CREATE POLICY "Clientes: Modificar usuarios de sucursal"
  ON clientes FOR ALL
  USING (
    is_super_admin() OR 
    sucursal_id = get_user_sucursal_id()
  );

-- MESAS: Ver y modificar mesas de la sucursal
CREATE POLICY "Mesas: Ver de sucursal"
  ON mesas FOR SELECT
  USING (
    is_super_admin() OR 
    sucursal_id = get_user_sucursal_id()
  );

CREATE POLICY "Mesas: Modificar usuarios de sucursal"
  ON mesas FOR ALL
  USING (
    is_super_admin() OR 
    sucursal_id = get_user_sucursal_id()
  );

-- CAJAS: Ver y modificar cajas de la sucursal
CREATE POLICY "Cajas: Ver de sucursal"
  ON cajas FOR SELECT
  USING (
    is_super_admin() OR 
    sucursal_id = get_user_sucursal_id()
  );

CREATE POLICY "Cajas: Modificar usuarios de sucursal"
  ON cajas FOR ALL
  USING (
    is_super_admin() OR 
    sucursal_id = get_user_sucursal_id()
  );

-- CONFIG_SUCURSAL: Solo admins pueden ver y modificar
CREATE POLICY "Config_sucursal: Ver de sucursal"
  ON config_sucursal FOR SELECT
  USING (
    is_super_admin() OR 
    sucursal_id = get_user_sucursal_id()
  );

CREATE POLICY "Config_sucursal: Modificar solo admins"
  ON config_sucursal FOR ALL
  USING (is_sucursal_admin());

-- HORARIOS_SUCURSAL: Similar a config
CREATE POLICY "Horarios_sucursal: Ver de sucursal"
  ON horarios_sucursal FOR SELECT
  USING (
    is_super_admin() OR 
    sucursal_id = get_user_sucursal_id()
  );

CREATE POLICY "Horarios_sucursal: Modificar solo admins"
  ON horarios_sucursal FOR ALL
  USING (is_sucursal_admin());

-- MÉTODOS_PAGO: Ver y modificar de la sucursal
CREATE POLICY "Metodos_pago: Ver de sucursal"
  ON metodos_pago FOR SELECT
  USING (
    is_super_admin() OR 
    sucursal_id = get_user_sucursal_id()
  );

CREATE POLICY "Metodos_pago: Modificar usuarios de sucursal"
  ON metodos_pago FOR ALL
  USING (
    is_super_admin() OR 
    sucursal_id = get_user_sucursal_id()
  );

-- ZONAS_ENTREGA: Ver y modificar de la sucursal
CREATE POLICY "Zonas_entrega: Ver de sucursal"
  ON zonas_entrega FOR SELECT
  USING (
    is_super_admin() OR 
    sucursal_id = get_user_sucursal_id()
  );

CREATE POLICY "Zonas_entrega: Modificar usuarios de sucursal"
  ON zonas_entrega FOR ALL
  USING (
    is_super_admin() OR 
    sucursal_id = get_user_sucursal_id()
  );

-- INGREDIENTES: Ver todos, modificar solo usuarios autenticados
CREATE POLICY "Ingredientes: Ver todos"
  ON ingredientes FOR SELECT
  USING (TRUE);

CREATE POLICY "Ingredientes: Modificar usuarios autenticados"
  ON ingredientes FOR ALL
  USING (auth.uid() IS NOT NULL);

-- MOVIMIENTOS_STOCK: Ver y modificar usuarios autenticados
CREATE POLICY "Movimientos_stock: Ver usuarios autenticados"
  ON movimientos_stock FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Movimientos_stock: Crear usuarios autenticados"
  ON movimientos_stock FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
