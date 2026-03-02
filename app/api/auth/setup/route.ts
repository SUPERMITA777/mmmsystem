import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
    try {
        const { email, password, nombre } = await req.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email y contraseña son requeridos' },
                { status: 400 }
            );
        }

        // Check if any admin users already exist
        const { data: existingUsers, error: checkError } = await supabaseAdmin
            .from('usuarios')
            .select('id')
            .in('rol', ['super_admin', 'admin'])
            .limit(1);

        if (existingUsers && existingUsers.length > 0) {
            return NextResponse.json(
                { error: 'Ya existe un usuario administrador. Use el panel para crear más usuarios.' },
                { status: 403 }
            );
        }

        // Create the auth user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        });

        if (authError) {
            return NextResponse.json(
                { error: `Error al crear usuario: ${authError.message}` },
                { status: 500 }
            );
        }

        // Insert into usuarios table
        const { error: insertError } = await supabaseAdmin
            .from('usuarios')
            .insert({
                id: authData.user.id,
                email,
                nombre: nombre || 'Administrador',
                rol: 'super_admin',
                activo: true,
            });

        if (insertError) {
            // Rollback: delete the auth user if insert fails
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            return NextResponse.json(
                { error: `Error al crear perfil: ${insertError.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Usuario administrador creado exitosamente',
            user: { id: authData.user.id, email },
        });
    } catch (err: any) {
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
