import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Handle root redirect to default tenant (mmm) to serve as the main page
    if (pathname === '/') {
        return NextResponse.rewrite(new URL('/mmm', request.url));
    }

    // 2. Handle /admin legacy root redirect to /mmm/admin
    if (pathname === '/admin') {
        return NextResponse.redirect(new URL('/mmm/admin', request.url));
    }

    // 3. Protect all /[tenant]/admin routes
    // Regex to match /[tenant]/admin/... but NOT /[tenant]/admin/login
    const adminMatch = pathname.match(/^\/([^\/]+)\/admin(?!\/login)(.*)/);

    if (adminMatch) {
        const tenant = adminMatch[1];
        // Skip superadmin from this check if needed, but usually superadmin is at /superadmin
        if (tenant === 'superadmin') return NextResponse.next();

        const accessToken = request.cookies.get('sb-access-token')?.value;

        if (!accessToken) {
            const loginUrl = new URL(`/${tenant}/admin/login`, request.url);
            return NextResponse.redirect(loginUrl);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
