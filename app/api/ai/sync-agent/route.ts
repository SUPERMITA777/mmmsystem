/**
 * sync-agent/route.ts
 * 
 * Webhook endpoint para el agente local de WhatsApp.
 * Recibe mensajes del cliente WhatsApp, los procesa con Gemini,
 * y devuelve la respuesta para enviar.
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { processWhatsAppMessage, getAgentConfig, updateAgentConfig } from "@/lib/aiAgentService";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { tenantId, sender, text, fromMe, status, qr, phone } = body;

        // Validate required fields
        if (!tenantId) {
            return NextResponse.json(
                { error: "Falta campo requerido: tenantId" },
                { status: 400 }
            );
        }

        // Resolve tenantId → sucursal_id
        // tenantId can be the slug or the UUID
        let sucursalId = tenantId;

        // Check if tenantId is a slug
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId);
        if (!isUUID) {
            const { data: sucursal } = await supabaseAdmin
                .from("sucursales")
                .select("id")
                .eq("slug", tenantId)
                .single();

            if (!sucursal) {
                return NextResponse.json(
                    { error: "Tenant no encontrado" },
                    { status: 404 }
                );
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

        // Validate message fields
        if (!sender || !text) {
            return NextResponse.json(
                { error: "Faltan campos requeridos para procesar mensaje: sender, text" },
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

        // Process the message
        const result = await processWhatsAppMessage(
            sucursalId,
            sender,
            text,
            fromMe || false
        );

        // Return reply
        return NextResponse.json({
            reply: result.reply || null,
            action: result.action || null,
        });
    } catch (error: any) {
        console.error("[sync-agent] Error:", error.message);
        return NextResponse.json(
            { error: "Error interno del servidor", details: error.message },
            { status: 500 }
        );
    }
}
