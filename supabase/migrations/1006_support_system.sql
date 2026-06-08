-- Crear tabla support_tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'abierto',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Crear tabla support_messages
CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  mensaje TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Habilitar RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas antiguas si existen
DROP POLICY IF EXISTS "Soporte Tickets: super_admin gestiona todo" ON support_tickets;
DROP POLICY IF EXISTS "Soporte Tickets: sucursal gestiona propio" ON support_tickets;
DROP POLICY IF EXISTS "Soporte Mensajes: super_admin gestiona todo" ON support_messages;
DROP POLICY IF EXISTS "Soporte Mensajes: sucursal gestiona propio" ON support_messages;

-- Políticas para support_tickets
CREATE POLICY "Soporte Tickets: super_admin gestiona todo" ON support_tickets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
        AND usuarios.rol = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
        AND usuarios.rol = 'super_admin'
    )
  );

CREATE POLICY "Soporte Tickets: sucursal gestiona propio" ON support_tickets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
        AND usuarios.sucursal_id = support_tickets.sucursal_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
        AND usuarios.sucursal_id = support_tickets.sucursal_id
    )
  );

-- Políticas para support_messages
CREATE POLICY "Soporte Mensajes: super_admin gestiona todo" ON support_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
        AND usuarios.rol = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
        AND usuarios.rol = 'super_admin'
    )
  );

CREATE POLICY "Soporte Mensajes: sucursal gestiona propio" ON support_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets
      JOIN usuarios ON usuarios.sucursal_id = support_tickets.sucursal_id
      WHERE support_tickets.id = support_messages.ticket_id
        AND usuarios.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM support_tickets
      JOIN usuarios ON usuarios.sucursal_id = support_tickets.sucursal_id
      WHERE support_tickets.id = support_messages.ticket_id
        AND usuarios.id = auth.uid()
    )
  );
