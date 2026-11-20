/**
 * sync-agent/route.ts
 *
 * Webhook endpoint para el agente local de WhatsApp.
 * Recibe mensajes (texto, audios, imágenes, ubicación GPS) o eventos de
 * intervención humana (`humanTakeover`) y devuelve la respuesta para enviar.
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
    processWhatsAppMessage,
    getAgentConfig,
    updateAgentConfig,
    handleHumanTakeover,
} from "@/lib/aiAgentService";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            tenantId,
            sender,
            senderName,
            text,
            fromMe,
            humanTakeover,
            status,
            qr,
            phone,
            audio,
            audioMime,
            image,
            imageMime,
            location,
        } = body;

        if (!tenantId) {
            return NextResponse.json(
                { error: "Falta campo requerido: tenantId" },
                { status: 400 }
            );
        }

        // Resolve tenantId -> sucursal_id
        let sucursalId = tenantId;
        const isUUID =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId);
        if (!isUUID) {
            const { data: sucursal } = await supabaseAdmin
                .from("sucursales")
                .select("id")
                .ilike("slug", tenantId)
                .single();

            if (!sucursal) {
                return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
            }
            sucursalId = sucursal.id;
        }

        // Handle status updates from local-agent
        if (status) {
            const success = await updateAgentConfig(sucursalId, {
                whatsapp_status: status,
                whatsapp_qr: qr || null,
                whatsapp_phone: phone || null,
            });
            return NextResponse.json({ success });
        }

        if (!sender || (!text && !audio && !image && !location)) {
            return NextResponse.json(
                { error: "Faltan campos requeridos para procesar mensaje: sender y contenido" },
                { status: 400 }
            );
        }

        // Verify agent is enabled
        const config = await getAgentConfig(sucursalId);
        if (!config.enabled || !config.whatsapp_enabled) {
            return NextResponse.json(
                { reply: null, reason: "agent_disabled" },
                { status: 200 }
            );
        }

        // Human-in-the-loop takeover: a human staff member answered manually on WhatsApp
        if (fromMe && humanTakeover) {
            const pauseResult = await handleHumanTakeover(
                sucursalId,
                sender,
                text || "[Mensaje del local]",
                senderName
            );
            return NextResponse.json({
                reply: null,
                paused: true,
                pausedMinutes: pauseResult.pausedMinutes,
            });
        }

        if (fromMe) {
            return NextResponse.json({ reply: null });
        }

        const result = await processWhatsAppMessage(sucursalId, sender, text || "", {
            fromMe: false,
            dryRun: false,
            audioBase64: audio,
            audioMimeType: audioMime,
            imageBase64: image,
            imageMimeType: imageMime,
            location,
            senderName,
        });

        return NextResponse.json({
            reply: result.reply || null,
            action: result.action || null,
            handoff: result.handoff || false,
        });
    } catch (error: any) {
        console.error("[sync-agent] Error:", error.message);
        return NextResponse.json(
            { error: "Error interno del servidor", details: error.message },
            { status: 500 }
        );
    }
}
