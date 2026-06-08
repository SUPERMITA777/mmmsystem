import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import webpush from "web-push";

// Configurar web-push
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@mmm-system.com";
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export async function POST(request: Request) {
  try {
    // 1. Validar el secreto de webhook
    const secret = request.headers.get("x-support-webhook-secret") || request.headers.get("support-webhook-secret");
    const expectedSecret = process.env.SUPPORT_WEBHOOK_SECRET;

    if (!expectedSecret || secret !== expectedSecret) {
      console.warn("Intento de notificación no autorizado o secreto no configurado");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Obtener el cuerpo de la petición
    const body = await request.json();
    
    // El payload puede venir directo de la app o envuelto en un webhook de Supabase (record)
    let payload = body;
    if (body.type && body.table === "support_messages" && body.record) {
      payload = {
        ticketId: body.record.ticket_id,
        mensaje: body.record.mensaje,
        usuarioId: body.record.usuario_id,
        sucursalNombre: body.record.sucursal_nombre // si se incluye
      };
    }

    const { ticketId, mensaje, usuarioId, sucursalNombre } = payload;

    // 3. Buscar todos los usuarios con rol 'super_admin'
    const { data: adminUsers, error: adminError } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("rol", "super_admin");

    if (adminError) {
      console.error("Error buscando administradores:", adminError);
      return NextResponse.json({ error: adminError.message }, { status: 500 });
    }

    if (!adminUsers || adminUsers.length === 0) {
      return NextResponse.json({ message: "No hay administradores registrados" });
    }

    // Excluir al remitente si es un admin para evitar auto-notificación
    const adminIds = adminUsers
      .map((u) => u.id)
      .filter((id) => id !== usuarioId);

    if (adminIds.length === 0) {
      return NextResponse.json({ message: "No hay otros administradores para notificar" });
    }

    // 4. Buscar suscripciones push activas de estos administradores
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, usuario_id, subscription_json")
      .in("usuario_id", adminIds)
      .eq("activo", true);

    if (subError) {
      console.error("Error buscando suscripciones push:", subError);
      return NextResponse.json({ error: subError.message }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ message: "No hay suscripciones push activas" });
    }

    // 5. Enviar las notificaciones push
    const notificationPayload = JSON.stringify({
      title: sucursalNombre ? `MMM Soporte — ${sucursalNombre}` : "MMM Soporte — mensaje nuevo",
      body: mensaje || "Nuevo mensaje recibido",
      ticketId: ticketId || "",
      sucursalNombre: sucursalNombre || ""
    });

    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          const pushSubscription = sub.subscription_json as unknown as webpush.PushSubscription;
          await webpush.sendNotification(pushSubscription, notificationPayload);
          return { id: sub.id, success: true };
        } catch (err: any) {
          // 410 Gone o 404 Not Found indica que la suscripción ya no es válida
          if (err.statusCode === 410 || err.statusCode === 404) {
            console.log(`Suscripción expirada ${sub.id}, marcando como inactiva`);
            await supabaseAdmin
              .from("push_subscriptions")
              .update({ activo: false })
              .eq("id", sub.id);
            return { id: sub.id, success: false, reason: "expired" };
          }
          console.error(`Error enviando push a suscripción ${sub.id}:`, err);
          return { id: sub.id, success: false, error: err.message };
        }
      })
    );

    return NextResponse.json({
      message: "Notificaciones procesadas",
      enviadas: results.filter((r) => r.success).length,
      fallidas: results.filter((r) => !r.success).length,
      detalles: results
    });

  } catch (error: any) {
    console.error("Error en API de notificaciones push:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
