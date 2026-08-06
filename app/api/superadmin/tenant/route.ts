import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Helper para verificar que el caller es superadmin
async function verifySuperAdmin(): Promise<{ user: any; error?: NextResponse }> {
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { user: null, error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();
    if (roleData?.role !== "superadmin") return { user: null, error: NextResponse.json({ error: "Forbidden (requiere superadmin)" }, { status: 403 }) };
    return { user };
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { nombre, slug, admin_email, admin_password } = body;

        if (!nombre || !slug || !admin_email || !admin_password) {
            return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
        }

        const { error: authErr } = await verifySuperAdmin();
        if (authErr) return authErr;

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

// DELETE: Archivar (activo=false) o eliminar permanentemente un tenant
export async function DELETE(request: Request) {
    try {
        const { error: authErr } = await verifySuperAdmin();
        if (authErr) return authErr;

        const body = await request.json();
        const { sucursal_id, action } = body; // action: "archive" | "delete"

        if (!sucursal_id || !["archive", "delete"].includes(action)) {
            return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
        }

        if (action === "archive") {
            // Solo marcar como inactivo
            const { error } = await supabaseAdmin
                .from("sucursales")
                .update({ activo: false })
                .eq("id", sucursal_id);

            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true, action: "archived" });
        }

        if (action === "delete") {
            // Obtener el user_id del admin principal de esta sucursal para eliminar el auth user también
            const { data: sucursal } = await supabaseAdmin
                .from("sucursales")
                .select("user_id, nombre")
                .eq("id", sucursal_id)
                .single();

            // Eliminar la sucursal (ON DELETE CASCADE en el schema borra todos los datos relacionados)
            const { error: delError } = await supabaseAdmin
                .from("sucursales")
                .delete()
                .eq("id", sucursal_id);

            if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

            // Eliminar el auth user si existe (ignorar error si ya no existe)
            if (sucursal?.user_id) {
                await supabaseAdmin.auth.admin.deleteUser(sucursal.user_id).catch(() => null);
            }

            return NextResponse.json({ success: true, action: "deleted" });
        }

    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Internal Error" }, { status: 500 });
    }
}

// PATCH: Restaurar un tenant archivado (activo=true)
export async function PATCH(request: Request) {
    try {
        const { error: authErr } = await verifySuperAdmin();
        if (authErr) return authErr;

        const body = await request.json();
        const { sucursal_id } = body;

        if (!sucursal_id) {
            return NextResponse.json({ error: "sucursal_id requerido" }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from("sucursales")
            .update({ activo: true })
            .eq("id", sucursal_id);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, action: "restored" });

    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Internal Error" }, { status: 500 });
    }
}

