-- ============================================
-- Migration 014: Fichas Técnicas (Recetas Independientes)
-- ============================================
-- Permite crear recetas nombradas que pueden contener
-- ingredientes del inventario y/o sub-recetas.
-- Los productos pueden tener una ficha técnica asignada
-- para calcular costo de producción y margen de ganancia.
-- ============================================

-- 1. Tabla principal de fichas técnicas (recetas independientes)
CREATE TABLE IF NOT EXISTS fichas_tecnicas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  costo_total NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ítems de cada ficha técnica
-- tipo = 'ingrediente' → ingrediente_id es el FK activo
-- tipo = 'sub_receta'  → sub_ficha_id es el FK activo
CREATE TABLE IF NOT EXISTS ficha_tecnica_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ficha_tecnica_id UUID REFERENCES fichas_tecnicas(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'ingrediente', -- 'ingrediente' | 'sub_receta'
  ingrediente_id UUID REFERENCES ingredientes(id) ON DELETE SET NULL,
  sub_ficha_id UUID REFERENCES fichas_tecnicas(id) ON DELETE SET NULL,
  cantidad NUMERIC(12,3) NOT NULL DEFAULT 1,
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Agregar FK en productos para la ficha técnica asignada
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'productos' AND column_name = 'ficha_tecnica_id'
  ) THEN
    ALTER TABLE productos ADD COLUMN ficha_tecnica_id UUID REFERENCES fichas_tecnicas(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_fichas_tecnicas_sucursal ON fichas_tecnicas(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_ficha_tecnica_items_ficha ON ficha_tecnica_items(ficha_tecnica_id);
CREATE INDEX IF NOT EXISTS idx_ficha_tecnica_items_ingrediente ON ficha_tecnica_items(ingrediente_id);
CREATE INDEX IF NOT EXISTS idx_productos_ficha_tecnica ON productos(ficha_tecnica_id);

-- 5. Trigger updated_at para fichas_tecnicas
CREATE TRIGGER update_fichas_tecnicas_updated_at
  BEFORE UPDATE ON fichas_tecnicas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. RLS
ALTER TABLE fichas_tecnicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ficha_tecnica_items ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas previas si existen
DO $$
BEGIN
  DROP POLICY IF EXISTS "Fichas Técnicas: Ver de sucursal" ON fichas_tecnicas;
  DROP POLICY IF EXISTS "Fichas Técnicas: Modificar de sucursal" ON fichas_tecnicas;
  DROP POLICY IF EXISTS "Ficha Items: Ver de sucursal" ON ficha_tecnica_items;
  DROP POLICY IF EXISTS "Ficha Items: Modificar de sucursal" ON ficha_tecnica_items;
END $$;

CREATE POLICY "Fichas Técnicas: Ver de sucursal"
  ON fichas_tecnicas FOR SELECT
  USING (sucursal_id = get_user_sucursal_id());

CREATE POLICY "Fichas Técnicas: Modificar de sucursal"
  ON fichas_tecnicas FOR ALL
  USING (sucursal_id = get_user_sucursal_id());

CREATE POLICY "Ficha Items: Ver de sucursal"
  ON ficha_tecnica_items FOR SELECT
  USING (sucursal_id = get_user_sucursal_id());

CREATE POLICY "Ficha Items: Modificar de sucursal"
  ON ficha_tecnica_items FOR ALL
  USING (sucursal_id = get_user_sucursal_id());

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
