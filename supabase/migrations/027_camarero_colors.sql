-- Migration para identificación de camareros por color y vinculación con pedidos
-- 1. Agregar color a la tabla de usuarios
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS color TEXT;

-- 2. Vincular pedidos con camareros
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS camarero_id UUID REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS camarero_nombre TEXT;

-- 3. Actualizar tabla mesas para incluir color del camarero actual (opcional, pero ayuda a la performance del mapa)
-- En lugar de eso, calcularemos el color desde el pedido activo en el MapaSalon.

-- 4. Permisos (opcional, asegurar que los mozos puedan ver los pedidos)
-- Las políticas de RLS ya permiten ver pedidos a usuarios autenticados generalmente.

-- Comentario para el usuario: Por favor ejecuta este SQL en tu editor de Supabase.
