import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET: Obtener historial de flyers de una sucursal
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const sucursalId = searchParams.get("sucursal_id");

        if (!sucursalId) {
            return NextResponse.json(
                { success: false, message: "sucursal_id es requerido" },
                { status: 400 }
            );
        }

        const { data, error } = await supabaseAdmin
            .from("marketing_flyers")
            .select("*")
            .eq("sucursal_id", sucursalId)
            .order("created_at", { ascending: false })
            .limit(50);

        if (error) {
            console.error("Error consultando marketing_flyers:", error);
            // Si la tabla no existe o falla temporalmente, retornar lista vacía
            return NextResponse.json({ success: true, data: [] });
        }

        return NextResponse.json({ success: true, data: data || [] });
    } catch (error: any) {
        console.error("Error en GET /api/marketing/flyers:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Error al obtener historial de flyers" },
            { status: 500 }
        );
    }
}

// DELETE: Eliminar un flyer generado
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const flyerId = searchParams.get("id");
        const sucursalId = searchParams.get("sucursal_id");

        if (!flyerId || !sucursalId) {
            return NextResponse.json(
                { success: false, message: "id y sucursal_id son requeridos" },
                { status: 400 }
            );
        }

        const { error } = await supabaseAdmin
            .from("marketing_flyers")
            .delete()
            .eq("id", flyerId)
            .eq("sucursal_id", sucursalId);

        if (error) {
            console.error("Error eliminando flyer:", error);
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, message: "Flyer eliminado" });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, message: error.message || "Error al eliminar flyer" },
            { status: 500 }
        );
    }
}
