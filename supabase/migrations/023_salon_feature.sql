-- Migration para features de Salón y Camarero
-- 1. Actualizar tabla pedidos
ALTER TABLE pedidos 
ADD COLUMN IF NOT EXISTS comensales INTEGER,
ADD COLUMN IF NOT EXISTS cubierto_cobrado BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS estado_cocina TEXT DEFAULT 'pendiente'; -- pendiente, preparando, listo (para comandas)

-- 2. Actualizar tabla mesas para mapa interactivo
ALTER TABLE mesas
ADD COLUMN IF NOT EXISTS pos_x NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pos_y NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS forma TEXT DEFAULT 'cuadrada', -- cuadrada, redonda, rectangular
ADD COLUMN IF NOT EXISTS width NUMERIC(10,2) DEFAULT 100,
ADD COLUMN IF NOT EXISTS height NUMERIC(10,2) DEFAULT 100;

-- 3. Actualizar tabla productos para impresora
ALTER TABLE productos
ADD COLUMN IF NOT EXISTS impresora TEXT DEFAULT 'COCINA1';

-- 4. Asegurar que haya un rol "camarero"
-- (Los roles en el front end suelen manejarse por texto, no hay tabla de roles strict si se usa un enum o text)
-- Actualizar config_sucursal si hiciera falta algo más, pero "impresoras_config" lo podemos manejar a nivel UI o con una columna nueva.
ALTER TABLE config_sucursal
ADD COLUMN IF NOT EXISTS impresoras_activas JSONB DEFAULT '["COCINA1", "COCINA2", "ENTRADA", "BARRA", "FACTURACION"]'::jsonb;
