import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Parser robusto para notificaciones de Lemon Cash
function parseLemonNotification(text: string) {
  // Regex para capturar el monto y opcionalmente el emisor
  // Ejemplos: 
  // "Recibiste un depósito de $1.500,00 de Juan Pérez"
  // "Recibiste $3500 de Maria Gomez"
  // "Recibiste un deposito de $ 1.250,50 de ..."
  const regex = /recibiste\s+(?:un\s+dep[oó]sito\s+de\s+)?\$?\s*([0-9.,\s]+)(?:\s+de\s+(.+))?/i;
  const match = text.match(regex);
  if (!match) return null;

  let rawAmount = match[1].replace(/\s/g, "");
  const emisor = match[2]?.trim() || "Desconocido";

  // Limpieza del monto
  // Si tiene puntos y comas, asumimos formato argentino (1.500,00)
  if (rawAmount.includes(",") && rawAmount.includes(".")) {
    rawAmount = rawAmount.replace(/\./g, "").replace(/,/g, ".");
  } else if (rawAmount.includes(",")) {
    rawAmount = rawAmount.replace(/,/g, ".");
  } else if (rawAmount.includes(".")) {
    const parts = rawAmount.split(".");
    // Si tiene un solo punto y dos decimales al final, es decimal. Sino, es separador de miles.
    if (parts.length === 2 && parts[1].length === 2) {
      // decimal
    } else {
      rawAmount = rawAmount.replace(/\./g, "");
    }
  }

  const monto = parseFloat(rawAmount);
  if (isNaN(monto)) return null;

  return { monto, emisor };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Validar el secreto de webhook
    const secret = request.headers.get("x-lemon-webhook-secret") || body.secret;
    const expectedSecret = process.env.LEMON_WEBHOOK_SECRET || "lemon_secret_123456"; // Fallback por defecto si no está en .env

    if (secret !== expectedSecret) {
      console.warn("[Lemon Webhook] Intento no autorizado o secreto incorrecto.");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sucursalId = body.sucursal_id;
    if (!sucursalId) {
      return NextResponse.json({ error: "sucursal_id is required" }, { status: 400 });
    }

    // 2. Extraer datos del depósito
    const texto = body.text || body.texto || "";
    let monto = body.monto ? parseFloat(body.monto) : null;
    let emisor = body.emisor || null;

    if (!monto && texto) {
      const parsed = parseLemonNotification(texto);
      if (parsed) {
        monto = parsed.monto;
        emisor = parsed.emisor;
      }
    }

    if (!monto) {
      console.warn("[Lemon Webhook] No se pudo extraer un monto válido del depósito.");
      return NextResponse.json({ error: "Could not parse amount from request" }, { status: 400 });
    }

    console.log(`[Lemon Webhook] Depósito recibido: $${monto} de ${emisor || "Desconocido"}. Sucursal: ${sucursalId}`);

    // 3. Crear registro de depósito en la base de datos
    const { data: deposito, error: insertError } = await supabaseAdmin
      .from("lemon_deposits")
      .insert({
        sucursal_id: sucursalId,
        monto,
        emisor,
        texto_notificacion: texto || `Depósito de $${monto}`,
        estado: "pendiente"
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Lemon Webhook] Error al insertar depósito:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // 4. Intentar buscar un pedido pendiente con el monto exacto
    const { data: pedidosCoincidentes, error: pedidosError } = await supabaseAdmin
      .from("pedidos")
      .select("id, numero_pedido, total")
      .eq("sucursal_id", sucursalId)
      .eq("estado", "pendiente")
      .eq("total", monto);

    if (pedidosError) {
      console.error("[Lemon Webhook] Error buscando pedidos coincidentes:", pedidosError);
      return NextResponse.json({ 
        message: "Depósito registrado pero falló la búsqueda de pedidos", 
        deposito_id: deposito.id 
      });
    }

    // Caso A: Existe EXACTAMENTE UN pedido con ese monto
    if (pedidosCoincidentes && pedidosCoincidentes.length === 1) {
      const pedido = pedidosCoincidentes[0];
      console.log(`[Lemon Webhook] Coincidencia exacta encontrada! Asociando depósito al pedido ${pedido.numero_pedido}`);

      // Actualizar pedido a confirmado y marcar pago_confirmado
      const { error: updatePedidoError } = await supabaseAdmin
        .from("pedidos")
        .update({ 
          estado: "confirmado", 
          pago_confirmado: true 
        })
        .eq("id", pedido.id);

      if (updatePedidoError) {
        console.error("[Lemon Webhook] Error al actualizar pedido:", updatePedidoError);
      } else {
        // Actualizar el depósito como asociado
        await supabaseAdmin
          .from("lemon_deposits")
          .update({ 
            pedido_id: pedido.id, 
            estado: "asociado" 
          })
          .eq("id", deposito.id);
      }

      return NextResponse.json({
        success: true,
        action: "auto_confirmed",
        pedido: {
          id: pedido.id,
          numero_pedido: pedido.numero_pedido,
          total: pedido.total
        },
        deposito: {
          id: deposito.id,
          monto,
          emisor
        }
      });
    }

    // Caso B: 0 o más de 1 pedido coincidente (requiere intervención manual)
    console.log(`[Lemon Webhook] No hay coincidencia unívoca. Pedidos coincidentes encontrados: ${pedidosCoincidentes?.length || 0}`);
    return NextResponse.json({
      success: true,
      action: "manual_intervention_required",
      coincidencias: pedidosCoincidentes?.length || 0,
      deposito: {
        id: deposito.id,
        monto,
        emisor
      }
    });

  } catch (error: any) {
    console.error("[Lemon Webhook] Error general en el endpoint:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
