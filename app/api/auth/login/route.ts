import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email y contraseña son requeridos' },
                { status: 400 }
            );
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

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

        const response = NextResponse.json({
            success: true,
            user: {
                id: data.user.id,
                email: data.user.email,
            },
        });

        // Set auth cookies for middleware
        response.cookies.set('sb-access-token', data.session.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 7 days
        });

        response.cookies.set('sb-refresh-token', data.session.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 30, // 30 days
        });

        return response;
    } catch (err: any) {
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
