import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Only protect /admin routes (except /admin/login)
    if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
        const accessToken = request.cookies.get('sb-access-token')?.value;

        if (!accessToken) {
            const loginUrl = new URL('/admin/login', request.url);
            return NextResponse.redirect(loginUrl);
        }

        // Verify the token with Supabase
        try {
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                {
                    global: {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                        },
                    },
                }
            );

            const { data: { user }, error } = await supabase.auth.getUser(accessToken);

            if (error || !user) {
                const loginUrl = new URL('/admin/login', request.url);
                return NextResponse.redirect(loginUrl);
            }
        } catch {
            const loginUrl = new URL('/admin/login', request.url);
            return NextResponse.redirect(loginUrl);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/:path*'],
};
