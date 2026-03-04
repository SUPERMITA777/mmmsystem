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

export async function POST() {
    try {
        const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (authError) {
            console.error('Auth List Error:', authError);
            return NextResponse.json({ error: authError.message }, { status: 400 });
        }

        const { data: sucursales } = await supabaseAdmin.from('sucursales').select('id').limit(1);
        const sucursalId = sucursales?.[0]?.id || null;

        for (const user of users) {
            const { error: upsertError } = await supabaseAdmin
                .from('usuarios')
                .upsert({
                    id: user.id,
                    email: user.email,
                    nombre: user.user_metadata?.nombre || user.email?.split('@')[0] || 'Usuario',
                    rol: user.user_metadata?.rol || 'empleado',
                    sucursal_id: sucursalId,
                    activo: true
                }, { onConflict: 'id' });

            if (upsertError) {
                console.error(`Error syncing user ${user.id}:`, upsertError);
            }
        }

        return NextResponse.json({ success: true, count: users.length });
    } catch (error: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
