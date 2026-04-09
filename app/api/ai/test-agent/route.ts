/**
 * test-agent/route.ts
 * 
 * Endpoint para simular conversaciones con el Agente IA desde el panel de administración.
 * No guarda mensajes en la base de datos (dryRun) para evitar ensuciar métricas reales.
 */

import { NextResponse } from "next/server";
import { processWhatsAppMessage, getAgentConfig } from "@/lib/aiAgentService";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { sucursalId, text, conversationHistory = [] } = body;

        if (!sucursalId || !text) {
            return NextResponse.json(
                { error: "Faltan campos requeridos: sucursalId, text" },
                { status: 400 }
            );
        }

        // Verify agent config exists
        const config = await getAgentConfig(sucursalId);
        
        // Use a dummy sender for simulation
        const dummySender = "simulador-admin";

        // Process message with dryRun = true
        // We pass the conversation history if provided to maintain context in the simulation
        const result = await processWhatsAppMessage(
            sucursalId,
            dummySender,
            text,
            false,
            true // dryRun flag
        );

        return NextResponse.json({
            success: true,
            reply: result.reply,
            action: result.action
        });

    } catch (error: any) {
        console.error("[test-agent] Error:", error.message);
        return NextResponse.json(
            { error: "Error en la simulación", details: error.message },
            { status: 500 }
        );
    }
}
