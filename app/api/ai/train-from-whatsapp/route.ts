/**
 * train-from-whatsapp/route.ts
 *
 * Analiza chats reales de WhatsApp (desde historial sincronizado en Supabase o
 * archivos `.txt` exportados) para extraer estilo de respuesta, ejemplos few-shot y FAQs.
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
    buildTranscriptFromExports,
    distillStyleAndKnowledge,
    getSyncedWhatsAppStats,
    loadSyncedWhatsAppTranscript,
    parseWhatsAppExportTxt,
} from "@/lib/whatsappTrainer";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const sucursalId = searchParams.get("sucursal_id");

        if (!sucursalId) {
            return NextResponse.json({ error: "sucursal_id requerido" }, { status: 400 });
        }

        const stats = await getSyncedWhatsAppStats(sucursalId);
        return NextResponse.json({ success: true, stats });
    } catch (error: any) {
        console.error("[train-from-whatsapp GET]:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            sucursalId,
            mode = "analyze",
            source = "db",
            rawTexts = [],
            businessNames = [],
        } = body as {
            sucursalId?: string;
            mode?: "preview_txt" | "analyze";
            source?: "db" | "txt" | "both";
            rawTexts?: string[];
            businessNames?: string[];
        };

        if (!sucursalId) {
            return NextResponse.json({ error: "sucursalId es requerido" }, { status: 400 });
        }

        // Modo 1: Previsualizar autores detectados en archivos .txt exportados
        if (mode === "preview_txt") {
            const authorCountMap = new Map<string, number>();
            let totalValidMessages = 0;

            for (const raw of rawTexts) {
                if (typeof raw !== "string" || !raw.trim()) continue;
                const parsed = parseWhatsAppExportTxt(raw, businessNames);
                totalValidMessages += parsed.messages.length;
                for (const a of parsed.authors) {
                    authorCountMap.set(a.name, (authorCountMap.get(a.name) || 0) + a.count);
                }
            }

            const authors = Array.from(authorCountMap.entries())
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 30);

            return NextResponse.json({
                success: true,
                authors,
                totalValidMessages,
            });
        }

        // Modo 2: Analizar conversaciones y destilar estilo + ejemplos + conocimiento
        const { data: sucursal } = await supabaseAdmin
            .from("sucursales")
            .select("nombre")
            .eq("id", sucursalId)
            .maybeSingle();

        const sucursalName = sucursal?.nombre || "Nuestro Negocio";

        const transcriptParts: string[] = [];
        const combinedStats = {
            total_messages_analyzed: 0,
            conversations_analyzed: 0,
            business_replies_found: 0,
        };

        if (source === "db" || source === "both") {
            const dbData = await loadSyncedWhatsAppTranscript(sucursalId);
            if (dbData.transcript) {
                transcriptParts.push(dbData.transcript);
                combinedStats.total_messages_analyzed += dbData.stats.total_messages_analyzed;
                combinedStats.conversations_analyzed += dbData.stats.conversations_analyzed;
                combinedStats.business_replies_found += dbData.stats.business_replies_found;
            }
        }

        if ((source === "txt" || source === "both") && Array.isArray(rawTexts) && rawTexts.length > 0) {
            const txtData = buildTranscriptFromExports(rawTexts, businessNames);
            if (txtData.transcript) {
                transcriptParts.push(txtData.transcript);
                combinedStats.total_messages_analyzed += txtData.stats.total_messages_analyzed;
                combinedStats.conversations_analyzed += txtData.stats.conversations_analyzed;
                combinedStats.business_replies_found += txtData.stats.business_replies_found;
            }
        }

        const fullTranscript = transcriptParts.join("\n\n").slice(0, 35000);
        if (!fullTranscript.trim()) {
            return NextResponse.json(
                {
                    error:
                        source === "db"
                            ? "No encontramos respuestas humanas previas en el historial sincronizado de WhatsApp. Subí un chat exportado (.txt) o sincronizá tus chats primero."
                            : "No pudimos extraer mensajes válidos de los archivos enviados. Verificá que sea un chat exportado de WhatsApp en formato .txt.",
                },
                { status: 400 }
            );
        }

        const result = await distillStyleAndKnowledge({
            sucursalId,
            sucursalName,
            transcript: fullTranscript,
            stats: combinedStats,
        });

        return NextResponse.json({ success: true, result });
    } catch (error: any) {
        console.error("[train-from-whatsapp POST]:", error.message);
        return NextResponse.json(
            { error: error.message || "Error analizando los chats" },
            { status: 500 }
        );
    }
}
