import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Service role client for reliable role lookup (bypasses RLS)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: any) {
                    cookieStore.set({ name, value, ...options });
                },
                remove(name: string, options: any) {
                    cookieStore.delete({ name, ...options });
                },
            },
        }
    );

    try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
            return NextResponse.json({ user: null }, { status: 401 });
        }

        // Use service role to reliably get the role (bypasses RLS)
        let rol = 'empleado';

        // 1. Check public.usuarios first
        const { data: userData } = await supabaseAdmin
            .from('usuarios')
            .select('rol, sucursal_id, nombre')
            .eq('id', user.id)
            .maybeSingle();
 
        let sucursal_id = null;
        let nombre = null;
        if (userData) {
            rol = userData.rol || rol;
            sucursal_id = userData.sucursal_id;
            nombre = userData.nombre;
        }

        // 2. If still default, check user_roles table as fallback
        if (rol === 'empleado') {
            const { data: roleData } = await supabaseAdmin
                .from('user_roles')
                .select('role')
                .eq('user_id', user.id)
                .maybeSingle();

            if (roleData?.role) {
                // Normalize: user_roles uses 'superadmin', public.usuarios uses 'super_admin'
                rol = roleData.role === 'superadmin' ? 'super_admin' : roleData.role;
            }
        }

        const { data: { session } } = await supabase.auth.getSession();

        return NextResponse.json({
            user: {
                id: user.id,
                email: user.email,
                rol,
                sucursal_id,
                nombre,
            },
            session,
        });
    } catch (err) {
        console.error('Auth check error:', err);
        return NextResponse.json({ user: null }, { status: 401 });
    }
}
