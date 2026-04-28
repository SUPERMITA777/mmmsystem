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
        const { sucursal_id } = await req.json();

        if (!sucursal_id) return NextResponse.json({ error: 'Sucursal ID is required' }, { status: 400 });
        
        console.log(`[Sync] Iniciando sincronización para sucursal: ${sucursal_id}`);

        // 1. Get all auth users
        const { data: { users: authUsers }, error: authError } = await supabaseAdmin.auth.admin.listUsers();
        if (authError) throw authError;

        console.log(`[Sync] Encontrados ${authUsers.length} usuarios en Auth`);

        // 2. Fetch existing usuarios to prevent overwriting other tenants' users
        const { data: existingUsuarios } = await supabaseAdmin.from('usuarios').select('id, sucursal_id');
        const existingMap = new Map(existingUsuarios?.map(u => [u.id, u.sucursal_id]) || []);

        // 3. Prepare data for upsert
        // We will map Auth users to the 'usuarios' table but preserve their sucursal_id if they already belong to another tenant.
        const usersToUpsert = authUsers.map(u => {
            const currentSucursalId = existingMap.get(u.id);
            // If they already exist in the DB with a sucursal, KEEP IT. If new, assign to this sucursal_id.
            const targetSucursalId = currentSucursalId !== undefined ? currentSucursalId : sucursal_id;
            
            return {
                id: u.id,
                email: u.email,
                nombre: u.user_metadata?.nombre || u.email?.split('@')[0] || 'Usuario',
                rol: u.user_metadata?.rol || 'empleado',
                sucursal_id: targetSucursalId,
                activo: true
            };
        });

        console.log(`[Sync] Realizando UPSERT de ${usersToUpsert.length} usuarios`);

        if (usersToUpsert.length > 0) {
            const { error: upsertError } = await supabaseAdmin
                .from('usuarios')
                .upsert(usersToUpsert, { onConflict: 'id' });
            
            if (upsertError) {
                console.error('[Sync] Error en upsert:', upsertError);
                throw upsertError;
            }
        }

        return NextResponse.json({ 
            success: true, 
            synced: usersToUpsert.length,
            totalAuth: authUsers.length 
        });
    } catch (error: any) {
        console.error('[Sync] Sync Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
