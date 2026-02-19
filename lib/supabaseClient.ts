import { createClient } from "@supabase/supabase-js";

/**
 * Cliente público de Supabase para uso en frontend
 * 
 * Este cliente respeta las políticas de Row Level Security (RLS)
 * y está diseñado para ser usado en Client Components y Server Components.
 * 
 * Uso:
 * - Client Components: import { supabase } from "@/lib/supabaseClient"
 * - Server Components: import { supabase } from "@/lib/supabaseClient"
 * - API Routes: import { supabase } from "@/lib/supabaseClient"
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan las credenciales públicas de Supabase. Verifica que NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY estén configuradas en .env"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

