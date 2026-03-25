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
        console.log("POST /api/flyer body:", body);
        
        const { id, sucursal_id, imagen_url, producto_id, es_eterno, fecha_desde, fecha_hasta, activo } = body;

        if (!sucursal_id) {
            return NextResponse.json({ success: false, message: "Falta sucursal_id" }, { status: 400 });
        }

        const flyerData: any = {
            sucursal_id,
            imagen_url,
            producto_id: producto_id || null,
            es_eterno: !!es_eterno,
            fecha_desde: es_eterno ? null : (fecha_desde || new Date().toISOString()),
            fecha_hasta: es_eterno ? null : (fecha_hasta || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()),
            activo: activo !== false,
        };

        // Si viene el ID y no está vacío, lo incluimos
        if (id && typeof id === "string" && id.trim() !== "" && id !== "undefined" && id !== "null") {
            flyerData.id = id;
        }

        console.log("Upserting flyer data:", flyerData);

        // Usamos upsert con onConflict sucursal_id para evitar el error de unique constraint
        const { error } = await supabaseAdmin
            .from("sucursal_flyers")
            .upsert(flyerData, { 
                onConflict: 'sucursal_id',
                ignoreDuplicates: false 
            });

        if (error) {
            console.error("Supabase upsert error:", error);
            return NextResponse.json({ 
                success: false, 
                message: `Database Error: ${error.message || JSON.stringify(error)}`,
                details: error
            }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Flyer guardado correctamente." });
    } catch (error: any) {
        console.error("Flyer API error:", error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
