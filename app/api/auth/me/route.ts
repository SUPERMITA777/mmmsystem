import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
    const accessToken = req.cookies.get('sb-access-token')?.value;

    if (!accessToken) {
        return NextResponse.json({ user: null }, { status: 401 });
    }

    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data: { user }, error } = await supabase.auth.getUser(accessToken);

        if (error || !user) {
            return NextResponse.json({ user: null }, { status: 401 });
        }

        return NextResponse.json({
            user: {
                id: user.id,
                email: user.email,
            },
        });
    } catch {
        return NextResponse.json({ user: null }, { status: 401 });
    }
}
