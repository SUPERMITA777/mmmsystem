import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

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

    // 3. Protect all /[tenant]/admin routes
    const adminMatch = pathname.match(/^\/([^\/]+)\/admin(?!\/login)(.*)/);

    if (adminMatch) {
        const tenant = adminMatch[1];
        if (tenant === 'superadmin') return response;

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            const loginUrl = new URL(`/${tenant}/admin/login`, request.url);
            return NextResponse.redirect(loginUrl);
        }
    }

    return response;
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
