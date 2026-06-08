import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { handleApiError, ValidationError, AuthError, handleSupabaseError } from '@/lib/errors';

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
            throw new ValidationError('Email y contraseña son requeridos');
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            throw new AuthError('Credenciales inválidas', 401);
        }

        // Look up the user's role and assigned branch (bypasses RLS)
        let rol = 'empleado';
        let tenantSlug: string | null = null;
        let sucursalId: string | null = null;

        const { data: userData, error: userError } = await supabaseAdmin
            .from('usuarios')
            .select('rol, sucursal_id')
            .eq('id', data.user.id)
            .maybeSingle();

        if (userError) {
            throw handleSupabaseError(userError);
        }

        if (userData?.rol) {
            rol = userData.rol;
        }
        if (userData?.sucursal_id) {
            sucursalId = userData.sucursal_id;
        }

        // Fallback: Check if they are the owner/creator of any sucursal
        if (!sucursalId) {
            const { data: ownerSuc, error: ownerError } = await supabaseAdmin
                .from('sucursales')
                .select('id, slug')
                .eq('user_id', data.user.id)
                .maybeSingle();
            
            if (ownerError) {
                throw handleSupabaseError(ownerError);
            }
            
            if (ownerSuc) {
                sucursalId = ownerSuc.id;
                rol = 'admin';
                tenantSlug = ownerSuc.slug;
            }
        }

        // If user has a sucursal, resolve its slug for redirect
        if (sucursalId && !tenantSlug) {
            const { data: sucData, error: sucError } = await supabaseAdmin
                .from('sucursales')
                .select('slug')
                .eq('id', sucursalId)
                .single();
            
            if (sucError) {
                throw handleSupabaseError(sucError);
            }
            
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
            session: data.session,
        });
    } catch (err: any) {
        return handleApiError(err);
    }
}

