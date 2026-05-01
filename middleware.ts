import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

// Service role client for tenant lookup (bypasses RLS)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const { pathname } = request.nextUrl;

    // 1. Handle root redirect to default tenant (mmm)
    if (pathname === '/') {
        return NextResponse.rewrite(new URL('/mmm', request.url));
    }

    // 2. Handle /admin legacy root redirect to /mmm/admin
    if (pathname === '/admin') {
        return NextResponse.redirect(new URL('/mmm/admin', request.url));
    }

    // 3. Protect all /[tenant]/admin routes (except login)
    const adminMatch = pathname.match(/^\/([^\/]+)\/admin(?!\/login)(.*)/);

    if (adminMatch) {
        const urlTenant = adminMatch[1];
        const subPath = adminMatch[2] || '';
        if (urlTenant === 'superadmin') return response;

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            const loginUrl = new URL(`/${urlTenant}/admin/login`, request.url);
            return NextResponse.redirect(loginUrl);
        }

        // ── Tenant Enforcement ──
        // Look up the user's role and assigned branch
        const { data: userData } = await supabaseAdmin
            .from('usuarios')
            .select('rol, sucursal_id')
            .eq('id', user.id)
            .maybeSingle();

        // Super admins can access any tenant
        if (userData?.rol === 'super_admin') {
            return response;
        }

        // Non-super_admin: verify they belong to the URL tenant
        if (userData?.sucursal_id) {
            const { data: sucData } = await supabaseAdmin
                .from('sucursales')
                .select('slug')
                .eq('id', userData.sucursal_id)
                .single();

            if (sucData?.slug && sucData.slug !== urlTenant) {
                // Redirect to their correct tenant, preserving the sub-path
                const correctUrl = new URL(`/${sucData.slug}/admin${subPath}`, request.url);
                return NextResponse.redirect(correctUrl);
            }
        }
    }

    return response;
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.json).*)',
    ],
};
