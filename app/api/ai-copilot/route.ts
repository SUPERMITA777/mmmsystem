/**
 * api/ai-copilot/route.ts
 *
 * POST: Conversación analítica y propuestas de cambio del Copiloto IA (aislado por sucursal_id + sesión).
 * GET:  Historial reciente de cambios (`ai_command_log`) y consumo mensual de tokens.
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyTenantSession } from "@/lib/serverAuth";
import { runBusinessCopilot, type CopilotMessage } from "@/lib/businessCopilot";
import { getMonthlyTokenUsage } from "@/lib/aiProviders";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { sucursalId, message, history = [], activePage } = body as {
            sucursalId?: string;
            message?: string;
            history?: CopilotMessage[];
            activePage?: string;
        };

        if (!sucursalId || !message?.trim()) {
            return NextResponse.json(
                { error: "Faltan campos requeridos: sucursalId y message" },
                { status: 400 }
            );
        }

        const auth = await verifyTenantSession(sucursalId);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const result = await runBusinessCopilot({
            sucursalId,
            message: message.trim(),
            history: Array.isArray(history) ? history : [],
            userName: auth.user.nombre,
            userRole: auth.user.rol,
            activePage,
        });

        return NextResponse.json({
            success: true,
            reply: result.reply,
            proposals: result.proposals,
            toolsUsed: result.toolsUsed,
            usage: result.usage ?? null,
            provider: result.provider,
            model: result.model,
        });
    } catch (error: any) {
        console.error("[ai-copilot POST]:", error.message);
        return NextResponse.json(
            { error: error.message || "Error interno en Copiloto IA" },
            { status: 500 }
        );
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const sucursalId = searchParams.get("sucursal_id");

        if (!sucursalId) {
            return NextResponse.json({ error: "sucursal_id requerido" }, { status: 400 });
        }

        const auth = await verifyTenantSession(sucursalId);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const [{ data: logs, error }, usage] = await Promise.all([
            supabaseAdmin
                .from("ai_command_log")
                .select("*")
                .eq("sucursal_id", sucursalId)
                .order("created_at", { ascending: false })
                .limit(30),
            getMonthlyTokenUsage(sucursalId),
        ]);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            data: logs || [],
            usage,
        });
    } catch (error: any) {
        console.error("[ai-copilot GET]:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
