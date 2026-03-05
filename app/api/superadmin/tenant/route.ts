import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { nombre, slug, admin_email, admin_password } = body;

        if (!nombre || !slug || !admin_email || !admin_password) {
            return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
        }

        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                },
            }
        );

        // 1. Verificar si el usuario actual es SuperAdmin
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "No autorizado (no autenticado)" }, { status: 401 });

        const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();
        if (roleData?.role !== "superadmin") return NextResponse.json({ error: "Forbidden (requiere superadmin)" }, { status: 403 });

        // 2. Crear al usuario admin a través de la SDK Admin (bypasses email check and lets us insert raw users)
        // NOTA: Para no complicar con Service Role, si el usuario ya existe auth arrojará error.
        let newUserId;
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: admin_email,
            password: admin_password,
            email_confirm: true,
            user_metadata: { role: 'admin' }
        });

        if (authError) {
            // Si el error es de que el email ya existe, igual no avanzamos para evitar duplicar
            return NextResponse.json({ error: "Error creando auth user: " + authError.message }, { status: 400 });
        }
        newUserId = authData.user.id;

        // 3. Crear el tenant en `sucursales` usando admin privileges
        const { data: tenant, error: tError } = await supabaseAdmin.from("sucursales").insert({
            nombre: nombre,
            slug: slug,
            user_id: newUserId,
            // defaults
            activo: true
        }).select().single();

        if (tError) {
            // Rollback user
            await supabaseAdmin.auth.admin.deleteUser(newUserId);
            return NextResponse.json({ error: "Error creando sucursal: " + tError.message }, { status: 400 });
        }

        // 4. Asignarle el rol "admin" al user para esta sucursal
        await supabaseAdmin.from("user_roles").insert({
            user_id: newUserId,
            role: 'admin',
            sucursal_id: tenant.id
        });

        // 5. Inicializar configuracion de sucursal
        await supabaseAdmin.from("config_sucursal").insert({
            sucursal_id: tenant.id
        });

        return NextResponse.json({ success: true, tenant });

    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Internal Error" }, { status: 500 });
    }
}
