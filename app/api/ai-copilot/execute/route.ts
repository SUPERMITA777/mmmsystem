/**
 * api/ai-copilot/execute/route.ts
 *
 * POST: Ejecuta una propuesta previamente aprobada por el usuario (con validación de escritura y sucursal).
 * PUT:  Revierte (Deshacer) un cambio registrado en `ai_command_log` de la misma sucursal.
 */

import { NextResponse } from "next/server";
import { verifyTenantSession } from "@/lib/serverAuth";
import {
    executeCopilotProposal,
    undoCopilotLogEntry,
    type PendingActionProposal,
} from "@/lib/businessCopilot";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { sucursalId, proposal, originalCommand = "" } = body as {
            sucursalId?: string;
            proposal?: PendingActionProposal;
            originalCommand?: string;
        };

        if (!sucursalId || !proposal || !proposal.actionType) {
            return NextResponse.json(
                { error: "Faltan datos requeridos: sucursalId y proposal" },
                { status: 400 }
            );
        }

        const auth = await verifyTenantSession(sucursalId, { requireWrite: true });
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const result = await executeCopilotProposal(sucursalId, proposal, originalCommand);
        return NextResponse.json(result, { status: result.success ? 200 : 400 });
    } catch (error: any) {
        console.error("[ai-copilot execute POST]:", error.message);
        return NextResponse.json(
            { success: false, message: error.message || "Error al ejecutar el cambio" },
            { status: 500 }
        );
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { sucursalId, logId } = body as {
            sucursalId?: string;
            logId?: string;
        };

        if (!sucursalId || !logId) {
            return NextResponse.json(
                { error: "Faltan datos requeridos: sucursalId y logId" },
                { status: 400 }
            );
        }

        const auth = await verifyTenantSession(sucursalId, { requireWrite: true });
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const result = await undoCopilotLogEntry(sucursalId, logId);
        return NextResponse.json(result, { status: result.success ? 200 : 400 });
    } catch (error: any) {
        console.error("[ai-copilot execute PUT]:", error.message);
        return NextResponse.json(
            { success: false, message: error.message || "Error al revertir el cambio" },
            { status: 500 }
        );
    }
}
