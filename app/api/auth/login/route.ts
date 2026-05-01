import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Service role client for reliable lookup (bypasses RLS)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
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
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email y contraseña son requeridos' },
                { status: 400 }
            );
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            return NextResponse.json(
                { error: 'Credenciales inválidas' },
                { status: 401 }
            );
        }

        // Look up the user's role and assigned branch (bypasses RLS)
        let rol = 'empleado';
        let tenantSlug: string | null = null;

        const { data: userData } = await supabaseAdmin
            .from('usuarios')
            .select('rol, sucursal_id')
            .eq('id', data.user.id)
            .maybeSingle();

        if (userData?.rol) {
            rol = userData.rol;
        }

        // If user has a sucursal, resolve its slug for redirect
        if (userData?.sucursal_id) {
            const { data: sucData } = await supabaseAdmin
                .from('sucursales')
                .select('slug')
                .eq('id', userData.sucursal_id)
                .single();
            
            if (sucData?.slug) {
                tenantSlug = sucData.slug;
            }
        }

        return NextResponse.json({
            success: true,
            user: {
                id: data.user.id,
                email: data.user.email,
                rol,
                tenantSlug,
            },
        });
    } catch (err: any) {
        console.error('Login error:', err);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
