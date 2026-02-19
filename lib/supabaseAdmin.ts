import { createClient } from "@supabase/supabase-js";

/**
 * Cliente administrativo de Supabase con permisos completos (Service Role)
 * 
 * ⚠️ ADVERTENCIA: Este cliente tiene acceso completo a la base de datos
 * y BYPASSEA todas las políticas de Row Level Security (RLS).
 * 
 * SOLO debe usarse en:
 * - Server Components de Next.js
 * - API Routes (Route Handlers)
 * - Server Actions
 * 
 * NUNCA debe usarse en:
 * - Client Components
 * - Código que se ejecuta en el navegador
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "Faltan las credenciales de Supabase. Verifica que las variables de entorno estén configuradas."
  );
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
