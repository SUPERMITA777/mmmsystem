import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { codigo, sucursalId } = await request.json();

    if (!codigo || !sucursalId) {
      return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("promo_qr_codigos")
      .select("*")
      .eq("sucursal_id", sucursalId)
      .eq("codigo", codigo.toUpperCase())
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ valid: false, message: "Código no encontrado" });
    }

    if (data.usado) {
      return NextResponse.json({ valid: false, message: "Este código ya fue utilizado" });
    }

    if (data.fecha_vencimiento && new Date(data.fecha_vencimiento) < new Date()) {
      return NextResponse.json({ valid: false, message: "Este código está vencido" });
    }

    return NextResponse.json({ valid: true, codigo: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
