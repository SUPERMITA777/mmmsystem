-- ============================================
-- MMM SYSTEM DELIVERY - Esquema Completo
-- ============================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Para búsquedas de texto

-- ============================================
-- TABLAS PRINCIPALES
-- ============================================

-- Sucursales / Locales
CREATE TABLE sucursales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  direccion TEXT,
  telefono TEXT,
  email TEXT,
  whatsapp_numero TEXT,
  slug TEXT UNIQUE NOT NULL, -- usado para /menu/[slug]
  activo BOOLEAN DEFAULT TRUE,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usuarios del sistema (extiende auth.users de Supabase)
CREATE TABLE usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nombre TEXT NOT NULL,
  apellido TEXT,
  telefono TEXT,
  avatar_url TEXT,
  rol TEXT NOT NULL DEFAULT 'empleado', -- super_admin, admin, cajero, cocinero, repartidor, empleado
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE SET NULL,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permisos por rol
CREATE TABLE permisos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rol TEXT NOT NULL UNIQUE,
  permisos JSONB NOT NULL DEFAULT '{}'::jsonb, -- {pedidos: ['crear', 'editar'], productos: ['ver']}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categorías de productos
CREATE TABLE categorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  imagen_url TEXT,
  orden INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Productos
CREATE TABLE productos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  nombre_interno TEXT,
  descripcion TEXT,
  precio NUMERIC(12,2) NOT NULL DEFAULT 0,
  precio_promocional NUMERIC(12,2),
  codigo_barras TEXT,
  imagen_url TEXT,
  stock_actual INTEGER DEFAULT 0,
  stock_minimo INTEGER DEFAULT 0,
  control_stock BOOLEAN DEFAULT FALSE,
  tiempo_coccion INTEGER, -- minutos
  visible_en_menu BOOLEAN DEFAULT TRUE,
  producto_oculto BOOLEAN DEFAULT FALSE,
  producto_sugerido BOOLEAN DEFAULT FALSE,
  activo BOOLEAN DEFAULT TRUE,
  destacado BOOLEAN DEFAULT FALSE,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Variantes de productos (tamaños, sabores, etc.)
CREATE TABLE variantes_producto (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_id UUID REFERENCES productos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL, -- "Grande", "Chico", "Sin azúcar", etc.
  precio_adicional NUMERIC(12,2) DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  orden INTEGER DEFAULT 0
);

-- Ingredientes base (materia prima)
CREATE TABLE ingredientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  unidad TEXT NOT NULL, -- gr, ml, unidad, kg, lt, etc.
  stock_actual NUMERIC(12,3) DEFAULT 0,
  stock_minimo NUMERIC(12,3) DEFAULT 0,
  costo_unitario NUMERIC(12,2) DEFAULT 0,
  proveedor TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recetas: cuánta materia prima consume un producto
CREATE TABLE recetas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_id UUID REFERENCES productos(id) ON DELETE CASCADE,
  ingrediente_id UUID REFERENCES ingredientes(id) ON DELETE RESTRICT,
  cantidad NUMERIC(12,3) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clientes
CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  apellido TEXT,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  notas TEXT,
  total_pedidos INTEGER DEFAULT 0,
  total_gastado NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sucursal_id, telefono)
);

-- Mesas (para salón)
CREATE TABLE mesas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  nombre TEXT, -- "Mesa 1", "Barra 1", etc.
  capacidad INTEGER DEFAULT 4,
  estado TEXT DEFAULT 'libre', -- libre, ocupada, reservada, mantenimiento
  ubicacion TEXT, -- "Salón", "Terraza", "Barra", etc.
  activa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sucursal_id, numero)
);

-- Métodos de pago
CREATE TABLE metodos_pago (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  codigo TEXT NOT NULL, -- efectivo, transferencia, tarjeta_debito, tarjeta_credito, mercado_pago, etc.
  activo BOOLEAN DEFAULT TRUE,
  requiere_confirmacion BOOLEAN DEFAULT FALSE,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sucursal_id, codigo)
);

-- Zonas de entrega
CREATE TABLE zonas_entrega (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  costo_envio NUMERIC(12,2) DEFAULT 0,
  minimo_compra NUMERIC(12,2) DEFAULT 0,
  envio_gratis_desde NUMERIC(12,2),
  tiempo_estimado_minutos INTEGER,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Repartidores
CREATE TABLE repartidores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  telefono TEXT NOT NULL,
  vehiculo TEXT, -- "Moto", "Bicicleta", "Auto", etc.
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pedidos
CREATE TABLE pedidos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  numero_pedido TEXT UNIQUE NOT NULL, -- "PED-001", auto-generado
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  cliente_nombre TEXT,
  cliente_telefono TEXT,
  cliente_direccion TEXT,
  mesa_id UUID REFERENCES mesas(id) ON DELETE SET NULL,
  repartidor_id UUID REFERENCES repartidores(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL, -- delivery, takeaway, salon
  estado TEXT DEFAULT 'pendiente', -- pendiente, confirmado, preparando, listo, en_camino, entregado, cancelado
  origen TEXT DEFAULT 'qr', -- qr, pos, pedidosya, rappi, ubereats, etc.
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  descuento NUMERIC(12,2) DEFAULT 0,
  costo_envio NUMERIC(12,2) DEFAULT 0,
  propina NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  metodo_pago_id UUID REFERENCES metodos_pago(id),
  metodo_pago_nombre TEXT,
  zona_entrega_id UUID REFERENCES zonas_entrega(id),
  notas TEXT,
  notas_internas TEXT, -- para cocina
  fecha_entrega TIMESTAMPTZ, -- para pedidos programados
  tiempo_preparacion_minutos INTEGER,
  created_by UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ítems de cada pedido
CREATE TABLE pedido_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id UUID REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES productos(id) ON DELETE SET NULL,
  nombre_producto TEXT NOT NULL, -- denormalizado por seguridad
  variante_id UUID REFERENCES variantes_producto(id) ON DELETE SET NULL,
  variante_nombre TEXT,
  cantidad INTEGER NOT NULL DEFAULT 1,
  precio_unitario NUMERIC(12,2) NOT NULL,
  descuento NUMERIC(12,2) DEFAULT 0,
  subtotal NUMERIC(12,2) GENERATED ALWAYS AS ((cantidad * precio_unitario) - descuento) STORED,
  notas TEXT, -- "Sin cebolla", "Bien cocido", etc.
  estado TEXT DEFAULT 'pendiente', -- pendiente, preparando, listo
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Movimientos de stock de ingredientes
CREATE TABLE movimientos_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ingrediente_id UUID REFERENCES ingredientes(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL, -- entrada, salida, ajuste, venta
  cantidad NUMERIC(12,3) NOT NULL,
  motivo TEXT,
  pedido_id UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  usuario_id UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cajas / Transacciones
CREATE TABLE cajas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) NOT NULL,
  fecha_apertura TIMESTAMPTZ DEFAULT NOW(),
  fecha_cierre TIMESTAMPTZ,
  monto_apertura NUMERIC(12,2) NOT NULL DEFAULT 0,
  monto_cierre NUMERIC(12,2),
  monto_esperado NUMERIC(12,2),
  diferencia NUMERIC(12,2),
  estado TEXT DEFAULT 'abierta', -- abierta, cerrada
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transacciones de caja
CREATE TABLE transacciones_caja (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caja_id UUID REFERENCES cajas(id) ON DELETE CASCADE,
  pedido_id UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL, -- ingreso, egreso, ajuste
  metodo_pago_id UUID REFERENCES metodos_pago(id),
  monto NUMERIC(12,2) NOT NULL,
  concepto TEXT,
  usuario_id UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Descuentos / Promociones
CREATE TABLE descuentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  codigo TEXT UNIQUE,
  tipo TEXT NOT NULL, -- porcentaje, fijo
  valor NUMERIC(12,2) NOT NULL,
  minimo_compra NUMERIC(12,2),
  maximo_descuento NUMERIC(12,2),
  fecha_inicio TIMESTAMPTZ,
  fecha_fin TIMESTAMPTZ,
  activo BOOLEAN DEFAULT TRUE,
  uso_limite INTEGER,
  uso_actual INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuración de sucursal
CREATE TABLE config_sucursal (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE UNIQUE,
  -- Modalidades
  enable_delivery BOOLEAN DEFAULT TRUE,
  enable_takeaway BOOLEAN DEFAULT TRUE,
  enable_salon BOOLEAN DEFAULT FALSE,
  -- Pedidos
  aceptar_pedidos BOOLEAN DEFAULT TRUE,
  confirmar_por_whatsapp BOOLEAN DEFAULT TRUE,
  pedidos_programados BOOLEAN DEFAULT TRUE,
  aceptar_propinas BOOLEAN DEFAULT TRUE,
  datos_cliente_obligatorios BOOLEAN DEFAULT TRUE,
  monto_minimo NUMERIC(12,2) DEFAULT 0,
  tiempo_preparacion_default INTEGER DEFAULT 30, -- minutos
  -- Notificaciones
  notificar_nuevo_pedido BOOLEAN DEFAULT TRUE,
  notificar_pedido_listo BOOLEAN DEFAULT TRUE,
  -- Integraciones
  whatsapp_numero TEXT,
  whatsapp_mensaje_template TEXT,
  -- Facturación
  punto_venta INTEGER,
  punto_venta_afip INTEGER,
  cuit TEXT,
  razon_social TEXT,
  condicion_iva TEXT, -- responsable_inscripto, monotributo, etc.
  -- Otros
  moneda TEXT DEFAULT 'ARS',
  impuesto_porcentaje NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Horarios por día de la semana
CREATE TABLE horarios_sucursal (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  dia INTEGER NOT NULL, -- 0=Lunes, 1=Martes, ..., 6=Domingo
  cerrado BOOLEAN DEFAULT FALSE,
  apertura1 TIME,
  cierre1 TIME,
  apertura2 TIME,
  cierre2 TIME,
  disponible_en TEXT[], -- Array de modalidades: ['delivery', 'takeaway', 'salon']
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sucursal_id, dia)
);

-- Configuración global de cerrado temporal
ALTER TABLE config_sucursal ADD COLUMN cerrado_temporalmente BOOLEAN DEFAULT FALSE;

-- ============================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ============================================

CREATE INDEX idx_productos_sucursal ON productos(sucursal_id);
CREATE INDEX idx_productos_categoria ON productos(categoria_id);
CREATE INDEX idx_productos_activo ON productos(activo);
CREATE INDEX idx_pedidos_sucursal ON pedidos(sucursal_id);
CREATE INDEX idx_pedidos_estado ON pedidos(estado);
CREATE INDEX idx_pedidos_tipo ON pedidos(tipo);
CREATE INDEX idx_pedidos_created_at ON pedidos(created_at DESC);
CREATE INDEX idx_pedido_items_pedido ON pedido_items(pedido_id);
CREATE INDEX idx_clientes_sucursal_telefono ON clientes(sucursal_id, telefono);
CREATE INDEX idx_mesas_sucursal ON mesas(sucursal_id);
CREATE INDEX idx_mesas_estado ON mesas(estado);
CREATE INDEX idx_cajas_sucursal ON cajas(sucursal_id);
CREATE INDEX idx_cajas_estado ON cajas(estado);
CREATE INDEX idx_movimientos_stock_ingrediente ON movimientos_stock(ingrediente_id);
CREATE INDEX idx_movimientos_stock_fecha ON movimientos_stock(created_at DESC);

-- Índices para búsqueda de texto
CREATE INDEX idx_productos_nombre_trgm ON productos USING gin(nombre gin_trgm_ops);
CREATE INDEX idx_clientes_nombre_trgm ON clientes USING gin(nombre gin_trgm_ops);

-- ============================================
-- FUNCIONES Y TRIGGERS
-- ============================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers de updated_at
CREATE TRIGGER update_sucursales_updated_at BEFORE UPDATE ON sucursales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_productos_updated_at BEFORE UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_config_sucursal_updated_at BEFORE UPDATE ON config_sucursal
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para generar número de pedido único
CREATE OR REPLACE FUNCTION generate_pedido_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  year_part TEXT;
  sequence_num INTEGER;
BEGIN
  year_part := TO_CHAR(NOW(), 'YY');
  
  -- Obtener el siguiente número de secuencia para el año (solo los últimos 6 dígitos)
  SELECT COALESCE(MAX(CAST(RIGHT(numero_pedido, 6) AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM pedidos
  WHERE numero_pedido LIKE 'PED-' || year_part || '%';
  
  new_number := 'PED-' || year_part || LPAD(sequence_num::TEXT, 6, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger para auto-generar número de pedido
CREATE OR REPLACE FUNCTION set_pedido_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_pedido IS NULL OR NEW.numero_pedido = '' THEN
    NEW.numero_pedido := generate_pedido_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_pedido_number_trigger
  BEFORE INSERT ON pedidos
  FOR EACH ROW
  EXECUTE FUNCTION set_pedido_number();

-- Función para actualizar stock al crear movimiento
CREATE OR REPLACE FUNCTION update_stock_on_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipo = 'entrada' THEN
    UPDATE ingredientes SET stock_actual = stock_actual + NEW.cantidad WHERE id = NEW.ingrediente_id;
  ELSIF NEW.tipo IN ('salida', 'venta') THEN
    UPDATE ingredientes SET stock_actual = stock_actual - NEW.cantidad WHERE id = NEW.ingrediente_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stock_trigger
  AFTER INSERT ON movimientos_stock
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_movement();

-- Función para actualizar estadísticas de cliente
CREATE OR REPLACE FUNCTION update_cliente_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE clientes 
    SET 
      total_pedidos = total_pedidos + 1,
      total_gastado = total_gastado + NEW.total
    WHERE id = NEW.cliente_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cliente_stats_trigger
  AFTER INSERT ON pedidos
  FOR EACH ROW
  WHEN (NEW.cliente_id IS NOT NULL)
  EXECUTE FUNCTION update_cliente_stats();
