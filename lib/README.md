# Clientes de Supabase

Este proyecto incluye dos clientes de Supabase para diferentes casos de uso:

## 🔵 Cliente Público (`supabaseClient.ts`)

**Uso:** Operaciones normales que respetan Row Level Security (RLS)

**Dónde usarlo:**
- ✅ Client Components (componentes que usan `'use client'`)
- ✅ Server Components
- ✅ API Routes / Route Handlers
- ✅ Server Actions

**Ejemplo:**
```typescript
import { supabase } from "@/lib/supabaseClient";

// En un Client Component
const { data, error } = await supabase
  .from('productos')
  .select('*');
```

**Características:**
- Respeta las políticas de RLS configuradas en Supabase
- Seguro para usar en el frontend
- Las credenciales son públicas (NEXT_PUBLIC_*)

---

## 🔴 Cliente Administrativo (`supabaseAdmin.ts`)

**Uso:** Operaciones administrativas que requieren permisos completos

**Dónde usarlo:**
- ✅ Server Components únicamente
- ✅ API Routes / Route Handlers únicamente
- ✅ Server Actions únicamente
- ❌ **NUNCA** en Client Components
- ❌ **NUNCA** en código que se ejecuta en el navegador

**Ejemplo:**
```typescript
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// En un Server Component o API Route
const { data, error } = await supabaseAdmin
  .from('usuarios')
  .select('*'); // Bypasea RLS
```

**Características:**
- ⚠️ **BYPASEA todas las políticas de RLS**
- ⚠️ Tiene acceso completo a la base de datos
- ⚠️ Solo debe usarse en el servidor
- Las credenciales son privadas (NO tienen NEXT_PUBLIC_)

---

## 🛡️ Seguridad

### Variables de Entorno

- **Públicas** (pueden exponerse al frontend):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

- **Privadas** (solo servidor):
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_SECRET_KEY`

### Reglas de Oro

1. **NUNCA** uses `supabaseAdmin` en Client Components
2. **NUNCA** expongas `SUPABASE_SERVICE_ROLE_KEY` al frontend
3. **SIEMPRE** usa `supabase` (cliente público) cuando sea posible
4. **SOLO** usa `supabaseAdmin` cuando necesites bypassear RLS

---

## 📝 Cuándo usar cada uno

### Usa `supabase` (cliente público) cuando:
- Los usuarios autenticados necesitan acceder a sus propios datos
- Quieres que RLS proteja los datos automáticamente
- Estás trabajando en el frontend
- Necesitas operaciones normales de CRUD

### Usa `supabaseAdmin` (cliente administrativo) cuando:
- Necesitas crear/actualizar datos sin restricciones de RLS
- Estás haciendo operaciones administrativas en el servidor
- Necesitas acceder a todos los datos sin importar el usuario
- Estás ejecutando migraciones o scripts de mantenimiento

---

## 🔗 Recursos

- [Documentación de Supabase](https://supabase.com/docs)
- [Row Level Security (RLS)](https://supabase.com/docs/guides/auth/row-level-security)
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
