import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// GET: obtener flyer activo de una sucursal
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const sucursalId = searchParams.get("sucursal_id");

        if (!sucursalId || sucursalId === "undefined" || sucursalId === "null") {
            return NextResponse.json({ success: false, message: "Falta sucursal_id válido" }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ success: false, message: "Error de configuración de Supabase" }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        const { data, error } = await supabase
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
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

// POST: crear o actualizar flyer
export async function POST(request: Request) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ 
                success: false, 
                message: "Error de configuración: Faltan variables de entorno de Supabase",
                details: {
                    hasUrl: !!supabaseUrl,
                    hasKey: !!supabaseServiceKey
                }
            }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        let body;
        try {
            body = await request.json();
        } catch (e) {
            return NextResponse.json({ success: false, message: "Cuerpo de solicitud inválido (no es JSON)" }, { status: 400 });
        }

        console.log("POST /api/flyer body:", body);
        
        const { id, sucursal_id, imagen_url, producto_id, es_eterno, fecha_desde, fecha_hasta, activo } = body;

        if (!sucursal_id) {
            return NextResponse.json({ success: false, message: "Falta sucursal_id" }, { status: 400 });
        }

        if (!imagen_url) {
            return NextResponse.json({ success: false, message: "Falta imagen_url" }, { status: 400 });
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
        const { error, data } = await supabase
            .from("sucursal_flyers")
            .upsert(flyerData, { 
                onConflict: 'sucursal_id'
            })
            .select();

        if (error) {
            console.error("Supabase upsert error:", error);
            return NextResponse.json({ 
                success: false, 
                message: `Database Error: ${error.message || "Error desconocido en la base de datos"}`,
                details: error
            }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Flyer guardado correctamente.", data });
    } catch (error: any) {
        console.error("Flyer API error fatal:", error);
        return NextResponse.json({ 
            success: false, 
            message: `Server Error: ${error.message || "Error fatal en el servidor"}`,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}
