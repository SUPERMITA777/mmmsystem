/**
 * test-agent/route.ts
 *
 * Endpoint para simular conversaciones con el Agente IA desde el panel de administración.
 * No guarda mensajes ni pedidos en la base de datos (dryRun) y mantiene historial + carrito en memoria.
 */

import { NextResponse } from "next/server";
import { processWhatsAppMessage } from "@/lib/aiAgentService";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            sucursalId,
            text,
            conversationHistory = [],
            cartState = null,
        } = body;

        if (!sucursalId || !text) {
            return NextResponse.json(
                { error: "Faltan campos requeridos: sucursalId, text" },
                { status: 400 }
            );
        }

        const dummySender = "simulador-admin";

        const result = await processWhatsAppMessage(sucursalId, dummySender, text, {
            fromMe: false,
            dryRun: true,
            simulatorHistory: Array.isArray(conversationHistory) ? conversationHistory : [],
            simulatorCart: cartState,
        });

        return NextResponse.json({
            success: true,
            reply: result.reply,
            action: result.action,
            cart: result.cart ?? null,
            usage: result.usage ?? null,
        });
    } catch (error: any) {
        console.error("[test-agent] Error:", error.message);
        return NextResponse.json(
            { error: "Error en la simulación", details: error.message },
            { status: 500 }
        );
    }
}
