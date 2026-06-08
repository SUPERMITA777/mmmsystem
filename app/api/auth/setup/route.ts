import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { handleApiError, handleSupabaseError, ValidationError, AuthError } from '@/lib/errors';

export async function POST(req: Request) {
    try {
        const { email, password, nombre } = await req.json();

        if (!email || !password) {
            throw new ValidationError('Email y contraseña son requeridos');
        }

        // Check if any admin users already exist
        const { data: existingUsers, error: checkError } = await supabaseAdmin
            .from('usuarios')
            .select('id')
            .in('rol', ['super_admin', 'admin'])
            .limit(1);

        if (checkError) {
            throw handleSupabaseError(checkError);
        }

        if (existingUsers && existingUsers.length > 0) {
            throw new AuthError('Ya existe un usuario administrador. Use el panel para crear más usuarios.', 403);
        }

        // Create the auth user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        });

        if (authError) {
            throw new Error(`Error al crear usuario: ${authError.message}`);
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
            throw handleSupabaseError(insertError);
        }

        return NextResponse.json({
            success: true,
            message: 'Usuario administrador creado exitosamente',
            user: { id: authData.user.id, email },
        });
    } catch (err: any) {
        return handleApiError(err);
    }
}

