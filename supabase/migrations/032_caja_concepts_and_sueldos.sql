-- Migration 032: Add tipo_sueldo, custom concepts table, and pagos_sueldo table
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tipo_sueldo TEXT DEFAULT 'MES';

-- Table for custom financial concepts (payment categories)
CREATE TABLE IF NOT EXISTS conceptos_movimiento (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL, -- 'ingreso' or 'egreso'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for employee salary payments tracking
CREATE TABLE IF NOT EXISTS pagos_sueldo (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  caja_id UUID REFERENCES cajas(id) ON DELETE SET NULL,
  monto NUMERIC(12,2) NOT NULL,
  fecha_pago TIMESTAMPTZ DEFAULT NOW(),
  metodo_pago_id UUID REFERENCES metodos_pago(id) ON DELETE SET NULL,
  metodo_pago_nombre TEXT,
  concepto TEXT DEFAULT 'Pago de Sueldo',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE conceptos_movimiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_sueldo ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to prevent errors if re-run)
DROP POLICY IF EXISTS "conceptos_movimiento_select" ON conceptos_movimiento;
DROP POLICY IF EXISTS "conceptos_movimiento_all" ON conceptos_movimiento;
DROP POLICY IF EXISTS "pagos_sueldo_select" ON pagos_sueldo;
DROP POLICY IF EXISTS "pagos_sueldo_all" ON pagos_sueldo;

-- Policies for conceptos_movimiento
CREATE POLICY "conceptos_movimiento_select" ON conceptos_movimiento
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "conceptos_movimiento_all" ON conceptos_movimiento
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid() AND usuarios.rol IN ('super_admin', 'admin')
    )
  );

-- Policies for pagos_sueldo
CREATE POLICY "pagos_sueldo_select" ON pagos_sueldo
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "pagos_sueldo_all" ON pagos_sueldo
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid() AND usuarios.rol IN ('super_admin', 'admin')
    )
  );

-- Insert some default concepts for sucursal_id = null (global) or we can populate it dynamically.
-- Let's reload schema cache
NOTIFY pgrst, 'reload schema';
