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

    // Helper para redirigir conservando las cookies actualizadas de Supabase
    const redirectWithCookies = (url: URL | string) => {
        const redirectResponse = NextResponse.redirect(url);
        response.cookies.getAll().forEach((cookie) => {
            redirectResponse.cookies.set(cookie.name, cookie.value, {
                path: cookie.path,
                domain: cookie.domain,
                maxAge: cookie.maxAge,
                expires: cookie.expires,
                secure: cookie.secure,
                httpOnly: cookie.httpOnly,
                sameSite: cookie.sameSite,
            });
        });
        return redirectResponse;
    };

    const { pathname } = request.nextUrl;


    // 2. Handle /admin legacy root redirect to /mmm/admin
    if (pathname === '/admin') {
        return redirectWithCookies(new URL('/mmm/admin', request.url));
    }

    // 3. Protect all /[tenant]/admin and /[tenant]/camarero routes (except login)
    const adminMatch = pathname.match(/^\/([^\/]+)\/(admin|camarero)(?!\/login)(.*)/);

    if (adminMatch) {
        const urlTenant = adminMatch[1];
        const section = adminMatch[2]; // 'admin' or 'camarero'
        const subPath = adminMatch[3] || '';

        if (urlTenant === 'superadmin') return response;

        const { data: { user } } = await supabase.auth.getUser();

        // Only enforce login for admin section
        if (section === 'admin' && !user) {
            const loginUrl = new URL(`/${urlTenant}/admin/login`, request.url);
            return redirectWithCookies(loginUrl);
        }

        if (user) {
            // 1. Look up user role and sucursal
            const { data: userData } = await supabaseAdmin
                .from('usuarios')
                .select('rol, sucursal_id')
                .eq('id', user.id)
                .maybeSingle();

            let userRol = userData?.rol;
            let sucursalId = userData?.sucursal_id;

            // Fallback: Check if they are the owner/creator of any sucursal
            if (!sucursalId) {
                const { data: ownerSuc } = await supabaseAdmin
                    .from('sucursales')
                    .select('id, slug')
                    .eq('user_id', user.id)
                    .maybeSingle();
                
                if (ownerSuc) {
                    sucursalId = ownerSuc.id;
                    if (!userRol) {
                        userRol = 'admin'; // Sucursal owners are admins by default
                    }
                }
            }

            // 2. Role Authorization: 'camarero' cannot access '/admin'
            if (section === 'admin' && userRol === 'camarero') {
                const waiterUrl = new URL(`/${urlTenant}/camarero/pedir`, request.url);
                return redirectWithCookies(waiterUrl);
            }

            // 3. Super admins bypass tenant enforcement
            if (userRol === 'super_admin') {
                return response;
            }

            // 4. Tenant Enforcement (only on admin section to allow cross-tenant QR scanning for waiters)
            if (section === 'admin' && sucursalId) {
                const { data: sucData } = await supabaseAdmin
                    .from('sucursales')
                    .select('slug')
                    .eq('id', sucursalId)
                    .single();

                if (sucData?.slug && sucData.slug !== urlTenant) {
                    // Redirect to their correct tenant, preserving the section (admin/camarero) and sub-path
                    const correctUrl = new URL(`/${sucData.slug}/${section}${subPath}`, request.url);
                    return redirectWithCookies(correctUrl);
                }
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
