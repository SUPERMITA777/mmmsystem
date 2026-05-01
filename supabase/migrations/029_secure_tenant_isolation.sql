-- ============================================
-- FIX: Secure Tenant Data Isolation
-- ============================================

-- This migration fixes a security hole where authenticated users
-- could see products/categories of other tenants via the public
-- "Ver activos públicamente" policies.

-- 1. PRODUCTOS
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'productos') THEN
    DROP POLICY IF EXISTS "Productos: Ver activos públicamente" ON productos;
    -- Check if column 'activo' exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'productos' AND column_name = 'activo') THEN
      CREATE POLICY "Productos: Ver activos públicamente"
        ON productos FOR SELECT
        USING (
          activo = TRUE AND (
            auth.uid() IS NULL OR 
            is_super_admin() OR 
            sucursal_id = get_user_sucursal_id()
          )
        );
    ELSE
      CREATE POLICY "Productos: Ver activos públicamente"
        ON productos FOR SELECT
        USING (
          auth.uid() IS NULL OR 
          is_super_admin() OR 
          sucursal_id = get_user_sucursal_id()
        );
    END IF;
  END IF;
END $$;

-- 2. CATEGORIAS
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categorias') THEN
    DROP POLICY IF EXISTS "Categorias: Ver activas públicamente" ON categorias;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categorias' AND column_name = 'activo') THEN
      CREATE POLICY "Categorias: Ver activas públicamente"
        ON categorias FOR SELECT
        USING (
          activo = TRUE AND (
            auth.uid() IS NULL OR 
            is_super_admin() OR 
            sucursal_id = get_user_sucursal_id()
          )
        );
    ELSE
      CREATE POLICY "Categorias: Ver activas públicamente"
        ON categorias FOR SELECT
        USING (
          auth.uid() IS NULL OR 
          is_super_admin() OR 
          sucursal_id = get_user_sucursal_id()
        );
    END IF;
  END IF;
END $$;

-- 3. VARIANTES PRODUCTO (Safe check)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'variantes_producto') THEN
    ALTER TABLE variantes_producto ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Variantes: Ver de sucursal" ON variantes_producto;
    
    -- Check if variants or products have activo (usually variants use active products)
    CREATE POLICY "Variantes: Ver de sucursal"
      ON variantes_producto FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM productos p
          WHERE p.id = variantes_producto.producto_id
          AND (
            (auth.uid() IS NULL OR is_super_admin() OR p.sucursal_id = get_user_sucursal_id())
          )
        )
      );
  END IF;
END $$;

-- 4. GRUPOS ADICIONALES
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'grupos_adicionales') THEN
    ALTER TABLE grupos_adicionales ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Grupos Adicionales: Ver de sucursal" ON grupos_adicionales;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'grupos_adicionales' AND column_name = 'activo') THEN
      CREATE POLICY "Grupos Adicionales: Ver de sucursal"
        ON grupos_adicionales FOR SELECT
        USING (
          activo = TRUE AND (
            auth.uid() IS NULL OR 
            is_super_admin() OR 
            sucursal_id = get_user_sucursal_id()
          )
        );
    ELSE
      CREATE POLICY "Grupos Adicionales: Ver de sucursal"
        ON grupos_adicionales FOR SELECT
        USING (
          auth.uid() IS NULL OR 
          is_super_admin() OR 
          sucursal_id = get_user_sucursal_id()
        );
    END IF;
  END IF;
END $$;

-- 5. OPCIONES ADICIONAL
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'opciones_adicional') THEN
    ALTER TABLE opciones_adicional ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Opciones Adicional: Ver de sucursal" ON opciones_adicional;
    
    CREATE POLICY "Opciones Adicional: Ver de sucursal"
      ON opciones_adicional FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM grupos_adicionales g
          WHERE g.id = opciones_adicional.grupo_id
          AND (
            (auth.uid() IS NULL OR is_super_admin() OR g.sucursal_id = get_user_sucursal_id())
          )
        )
      );
  END IF;
END $$;

-- 6. DESCUENTOS (Ensure no public access if not intended)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'descuentos') THEN
    DROP POLICY IF EXISTS "Descuentos: Ver todos" ON descuentos;
    DROP POLICY IF EXISTS "Descuentos: Ver activos públicamente" ON descuentos;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'descuentos' AND column_name = 'activo') THEN
      CREATE POLICY "Descuentos: Ver activos de sucursal"
        ON descuentos FOR SELECT
        USING (
          activo = TRUE AND (
            auth.uid() IS NULL OR 
            is_super_admin() OR 
            sucursal_id = get_user_sucursal_id()
          )
        );
    ELSE
      CREATE POLICY "Descuentos: Ver activos de sucursal"
        ON descuentos FOR SELECT
        USING (
          auth.uid() IS NULL OR 
          is_super_admin() OR 
          sucursal_id = get_user_sucursal_id()
        );
    END IF;
  END IF;
END $$;

-- Notify PGRST
NOTIFY pgrst, 'reload schema';
