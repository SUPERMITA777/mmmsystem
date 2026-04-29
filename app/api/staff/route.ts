import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sucursalId = searchParams.get("sucursal_id");
    const all = searchParams.get("all") === "true";

    if (!sucursalId) {
        return NextResponse.json({ error: "sucursal_id required" }, { status: 400 });
    }

    try {
        let query = supabaseAdmin
            .from("usuarios")
            .select(all ? "*" : "id, nombre, email, rol, activo, color")
            .eq("sucursal_id", sucursalId);
        
        // Only filter active when not requesting all
        if (!all) {
            query = query.eq("activo", true);
        }
        
        query = query.order("nombre");

        const { data, error } = await query;

        if (error) throw error;

        return NextResponse.json(data || []);
    } catch (error: any) {
        console.error("Error fetching staff:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
