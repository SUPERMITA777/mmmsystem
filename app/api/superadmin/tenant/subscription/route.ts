import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function verifySuperAdmin() {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) { return cookieStore.get(name)?.value; }
            }
        }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();
    if (roleData?.role !== "superadmin") return null;

    return user;
}

export async function PUT(request: Request) {
    try {
        const superAdmin = await verifySuperAdmin();
        if (!superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await request.json();
        const { sucursal_id, days_to_add, exact_date } = body;

        if (!sucursal_id) return NextResponse.json({ error: "sucursal_id es requerido" }, { status: 400 });

        let updateData: any = {};

        if (exact_date) {
            updateData.subscription_end = new Date(exact_date).toISOString();
        } else if (days_to_add !== undefined) {
            // we calculate based on the current end date or now
            const { data: sucursal } = await supabaseAdmin.from("sucursales").select("subscription_end").eq("id", sucursal_id).single();
            const currentEnd = sucursal?.subscription_end ? new Date(sucursal.subscription_end) : new Date();
            
            // Si ya está expirada, sumamos desde HOY. Si tiene días vigentes, sumamos desde su FECHA ACTUAL de expiración.
            const offsetDate = currentEnd < new Date() ? new Date() : currentEnd;
            offsetDate.setDate(offsetDate.getDate() + parseInt(days_to_add));

            updateData.subscription_end = offsetDate.toISOString();
        } else {
            return NextResponse.json({ error: "Se requiere days_to_add o exact_date" }, { status: 400 });
        }

        const { error } = await supabaseAdmin.from("sucursales").update(updateData).eq("id", sucursal_id);

        if (error) return NextResponse.json({ error: "Error de BD: " + error.message }, { status: 500 });

        return NextResponse.json({ success: true, subscription_end: updateData.subscription_end });
        
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
