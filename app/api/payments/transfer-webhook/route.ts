import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Webhook genérico para avisos de transferencias recibidas (Personal Pay, etc.).
 *
 * Personal Pay no ofrece una API pública de cobros entrantes, por lo que el aviso se
 * obtiene reenviando la notificación del celular (MacroDroid / Tasker / "Notification
 * Forwarder") con un POST a este endpoint:
 *
 *   POST /api/payments/transfer-webhook
 *   Header: x-webhook-secret: <TRANSFER_WEBHOOK_SECRET>
 *   Body JSON: { "sucursal_id": "...", "fuente": "personal_pay", "text": "<texto de la notificación>" }
 *   (alternativamente "monto" y "emisor" ya parseados)
 */

// Extrae monto y emisor de textos tipo:
//  "Recibiste una transferencia de $ 1.500,00 de Juan Pérez"
//  "Te llegó una transferencia de $3500 de Maria Gomez"
function parseNotification(text: string) {
  const m = text.match(/\$\s*([0-9][0-9.,]*)/);
  if (!m) return null;

  let raw = m[1].replace(/[.,]+$/, "");
  if (raw.includes(",") && raw.includes(".")) {
    // formato argentino 1.500,00
    raw = raw.replace(/\./g, "").replace(",", ".");
  } else if (raw.includes(",")) {
    raw = raw.replace(",", ".");
  } else if (raw.includes(".")) {
    const parts = raw.split(".");
    if (!(parts.length === 2 && parts[1].length === 2)) raw = raw.replace(/\./g, "");
  }
  const monto = parseFloat(raw);
  if (isNaN(monto)) return null;

  const em = text.slice((m.index || 0) + m[0].length).match(/\s+de\s+(.+?)\s*\.?$/i);
  return { monto, emisor: em?.[1]?.trim() || "Desconocido" };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const expectedSecret = process.env.TRANSFER_WEBHOOK_SECRET;
    if (!expectedSecret) {
      return NextResponse.json({ error: "TRANSFER_WEBHOOK_SECRET no configurado en el servidor" }, { status: 500 });
    }
    const secret = request.headers.get("x-webhook-secret") || body.secret;
    if (secret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sucursalId = body.sucursal_id;
    if (!sucursalId) return NextResponse.json({ error: "sucursal_id is required" }, { status: 400 });

    const fuente: string = body.fuente || "personal_pay";
    const texto: string = body.text || body.texto || "";
    let monto: number | null = body.monto ? parseFloat(body.monto) : null;
    let emisor: string | null = body.emisor || null;

    if (!monto && texto) {
      const parsed = parseNotification(texto);
      if (parsed) {
        monto = parsed.monto;
        emisor = emisor || parsed.emisor;
      }
    }
    if (!monto) return NextResponse.json({ error: "Could not parse amount from request" }, { status: 400 });

    // Pedidos por transferencia aún sin cobrar y con el monto exacto
    const { data: candidatos, error: pedErr } = await supabaseAdmin
      .from("pedidos")
      .select("id, numero_pedido, total, estado, metodo_pago_nombre")
      .eq("sucursal_id", sucursalId)
      .eq("total", monto)
      .eq("pago_confirmado", false)
      .not("estado", "in", "(cancelado,entregado)")
      .ilike("metodo_pago_nombre", "%transfer%");

    if (pedErr) console.error("[Transfer Webhook] Error buscando pedidos:", pedErr);

    const unico = !pedErr && candidatos && candidatos.length === 1 ? candidatos[0] : null;

    const { data: deposito, error: insErr } = await supabaseAdmin
      .from("lemon_deposits")
      .insert({
        sucursal_id: sucursalId,
        monto,
        emisor,
        fuente,
        texto_notificacion: texto || `Transferencia de $${monto}`,
        estado: unico ? "asociado" : "pendiente",
        pedido_id: unico ? unico.id : null,
      })
      .select()
      .single();

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    if (unico) {
      const { error: updErr } = await supabaseAdmin.from("pedidos").update({ pago_confirmado: true }).eq("id", unico.id);
      if (updErr) {
        // No se pudo marcar: dejar el aviso pendiente para resolución manual
        await supabaseAdmin.from("lemon_deposits").update({ estado: "pendiente", pedido_id: null }).eq("id", deposito.id);
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }
      await supabaseAdmin.from("pedidos").update({ estado: "confirmado" }).eq("id", unico.id).eq("estado", "pendiente");
      return NextResponse.json({ success: true, action: "auto_confirmed", pedido: unico, deposito_id: deposito.id });
    }

    // 0 o varias coincidencias: el panel le pregunta al operador
    return NextResponse.json({
      success: true,
      action: "manual_intervention_required",
      coincidencias: candidatos?.length || 0,
      deposito_id: deposito.id,
    });
  } catch (error: any) {
    console.error("[Transfer Webhook] Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
