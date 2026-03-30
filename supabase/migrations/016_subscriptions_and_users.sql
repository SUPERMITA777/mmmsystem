-- migration file 016_subscriptions_and_users.sql

-- Añadir fecha límite de suscripción a sucursales
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMPTZ;

-- Por defecto, configuramos a las sucursales existentes con 30 días adicionales para no bloquearlas inmediatamente
UPDATE sucursales SET subscription_end = NOW() + INTERVAL '30 days' WHERE subscription_end IS NULL;
