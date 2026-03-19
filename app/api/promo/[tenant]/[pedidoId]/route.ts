import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Genera un código alfanumérico de 4 caracteres (letras mayúsculas + números)
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // evita O,0,I,1 para legibilidad
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Sortea un premio basado en pesos
function sortearPremio(premios: any[]): any | null {
  if (!premios || premios.length === 0) return null;
  const pesoTotal = premios.reduce((s: number, p: any) => s + (p.peso || 1), 0);
  let rand = Math.random() * pesoTotal;
  for (const premio of premios) {
    rand -= (premio.peso || 1);
    if (rand <= 0) return premio;
  }
  return premios[premios.length - 1];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; pedidoId: string }> }
) {
  const { tenant, pedidoId } = await params;

  try {
    // 1. Obtener sucursal_id desde el tenant
    const { data: sucursal } = await supabase
      .from("sucursales")
      .select("id")
      .eq("slug", tenant)
      .maybeSingle();

    if (!sucursal) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }
    const sucursalId = sucursal.id;

    // 2. Verificar si ya existe un código para este pedido
    const { data: existing } = await supabase
      .from("promo_qr_codigos")
      .select("*")
      .eq("pedido_id", pedidoId)
      .eq("sucursal_id", sucursalId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true, codigo: existing });
    }

    // 3. Verificar que la promo esté activa
    const { data: config } = await supabase
      .from("promo_qr_config")
      .select("*")
      .eq("sucursal_id", sucursalId)
      .maybeSingle();

    if (!config || !config.activo) {
      return NextResponse.json({ success: false, activo: false });
    }

    if (!config.premios || config.premios.length === 0) {
      return NextResponse.json({ success: false, activo: false, message: "Sin premios configurados" });
    }

    // 4. Sortear premio
    const premio = sortearPremio(config.premios);
    if (!premio) {
      return NextResponse.json({ success: false, message: "Error al sortear premio" }, { status: 500 });
    }

    // 5. Generar código único (reintentar hasta 10 veces si hay colisión)
    let codigo = "";
    let intentos = 0;
    while (intentos < 10) {
      const candidate = generateCode();
      const { data: existing } = await supabase
        .from("promo_qr_codigos")
        .select("id")
        .eq("sucursal_id", sucursalId)
        .eq("codigo", candidate)
        .maybeSingle();
      if (!existing) {
        codigo = candidate;
        break;
      }
      intentos++;
    }
    if (!codigo) {
      return NextResponse.json({ success: false, message: "No se pudo generar código único" }, { status: 500 });
    }

    // 6. Guardar en DB
    const { data: nuevo, error } = await supabase
      .from("promo_qr_codigos")
      .insert({
        sucursal_id: sucursalId,
        pedido_id: pedidoId,
        codigo,
        premio,
        usado: false,
        fecha_vencimiento: config.fecha_vencimiento_codigos || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, codigo: nuevo });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 });
  }
}
