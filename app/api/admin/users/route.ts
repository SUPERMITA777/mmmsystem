import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

export async function POST(req: Request) {
    try {
        const { email, password, nombre, rol, sucursal_id, pin } = await req.json();

        // 1. Create user in Supabase Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { nombre, rol }
        });

        if (authError) {
            console.error('Auth Error:', authError);
            return NextResponse.json({ error: authError.message }, { status: 400 });
        }

        // 2. Create profile in usuarios table
        const { error: profileError } = await supabaseAdmin
            .from('usuarios')
            .insert({
                id: authData.user.id,
                email,
                nombre,
                rol,
                sucursal_id,
                pin: pin || null
            });

        if (profileError) {
            console.error('Profile Error:', profileError);
            // Attempt cleanup of auth user if profile creation fails? 
            // For now, return error
            return NextResponse.json({ error: profileError.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, user: authData.user });
    } catch (error: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const { id, email, password, nombre, rol, activo, pin } = await req.json();

        if (!id) return NextResponse.json({ error: 'User ID is required' }, { status: 400 });

        const updateData: any = {};
        if (email) updateData.email = email;
        if (password) updateData.password = password;
        if (nombre || rol) {
            updateData.user_metadata = {
                ...updateData.user_metadata,
                ...(nombre ? { nombre } : {}),
                ...(rol ? { rol } : {})
            };
        }

        // 1. Update in Supabase Auth
        if (Object.keys(updateData).length > 0) {
            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, updateData);
            if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });
        }

        // 2. Update in usuarios table
        const profileUpdate: any = {};
        if (email) profileUpdate.email = email;
        if (nombre) profileUpdate.nombre = nombre;
        if (rol) profileUpdate.rol = rol;
        if (activo !== undefined) profileUpdate.activo = activo;
        if (pin !== undefined) profileUpdate.pin = pin;

        if (Object.keys(profileUpdate).length > 0) {
            const { error: profileError } = await supabaseAdmin
                .from('usuarios')
                .update(profileUpdate)
                .eq('id', id);

            if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'User ID is required' }, { status: 400 });

    try {
        // Delete from Auth (cascades or handled manually)
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
        if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
