# Scripts de Base de Datos

## Configuración Inicial

Para crear todas las tablas en Supabase, tienes dos opciones:

### Opción 1: Usar Supabase Dashboard (Recomendado)

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Navega a **SQL Editor**
3. Abre los archivos en `supabase/migrations/` en orden:
   - `001_initial_schema.sql` - Crea todas las tablas
   - `002_rls_policies.sql` - Configura Row Level Security
4. Ejecuta cada archivo completo

### Opción 2: Usar psql (Línea de comandos)

```bash
# Obtén la connection string de Supabase Dashboard > Settings > Database
# Connection string > URI

psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" -f supabase/migrations/001_initial_schema.sql
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" -f supabase/migrations/002_rls_policies.sql
```

## Verificar Instalación

Después de ejecutar las migraciones, verifica que las tablas se hayan creado:

```sql
-- En Supabase SQL Editor
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Deberías ver todas las tablas:
- sucursales
- usuarios
- categorias
- productos
- pedidos
- pedido_items
- clientes
- mesas
- cajas
- etc.
