/**
 * SERVER-SIDE SUPABASE ADMIN CLIENT (SERVICE ROLE)
 * 
 * ⚠️ ADVERTENCIA DE SEGURIDAD ⚠️
 * Este cliente utiliza la clave secreta `SUPABASE_SERVICE_ROLE_KEY` o `SUPABASE_SECRET_KEY`.
 * 
 * - OBLIGATORIO: Usar únicamente del lado del servidor (API Routes, Server Actions, Server Components).
 * - PROHIBIDO: Importar este archivo en cualquier componente del cliente o código accesible por el navegador.
 * - Nota: Este cliente omite por completo las políticas de Row Level Security (RLS).
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ''; // Usually in .env.local

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

