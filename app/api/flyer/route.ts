import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET: obtener flyer activo de una sucursal
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sucursalId = searchParams.get("sucursal_id");

    if (!sucursalId || sucursalId === "undefined" || sucursalId === "null") {
        return NextResponse.json({ success: false, message: "Falta sucursal_id válido" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
        .from("sucursal_flyers")
        .select("*")
        .eq("sucursal_id", sucursalId)
        .limit(1);

    if (error) {
        console.error("GET /api/flyer error:", error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    const flyer = data && data.length > 0 ? data[0] : null;

    return NextResponse.json({ success: true, data: flyer });
}

// POST: crear o actualizar flyer
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, sucursal_id, imagen_url, producto_id, es_eterno, fecha_desde, fecha_hasta, activo } = body;

        const flyerData = {
            sucursal_id,
            imagen_url,
            producto_id,
            es_eterno,
            fecha_desde: es_eterno ? null : (fecha_desde || new Date().toISOString()),
            fecha_hasta: es_eterno ? null : (fecha_hasta || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()),
            activo,
        };

        if (id) {
            // Update
            const { error } = await supabaseAdmin
                .from("sucursal_flyers")
                .update(flyerData)
                .eq("id", id);

            if (error) throw error;
        } else {
            // Insert
            const { error } = await supabaseAdmin
                .from("sucursal_flyers")
                .insert([flyerData]);

            if (error) throw error;
        }

        return NextResponse.json({ success: true, message: "Flyer guardado correctamente." });
    } catch (error: any) {
        console.error("Flyer API error:", error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
