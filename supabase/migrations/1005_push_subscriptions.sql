-- Crear tabla push_subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  subscription_json JSONB NOT NULL,
  activo BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Crear índice para mejorar consultas por usuario
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_usuario ON push_subscriptions(usuario_id);

-- Habilitar RLS (Seguridad a Nivel de Fila)
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Política 1: Los usuarios pueden gestionar sus propias suscripciones (Ver, Crear, Editar, Eliminar)
CREATE POLICY "Suscripciones: gestionar propias" ON push_subscriptions
  FOR ALL
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

-- Política 2: Los super_admins pueden consultar todas las suscripciones (para enviar notificaciones push)
CREATE POLICY "Suscripciones: super_admin ver todas" ON push_subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
        AND usuarios.rol = 'super_admin'
    )
  );
