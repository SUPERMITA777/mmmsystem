import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getOrCreateConversation } from "@/lib/aiAgentService";
import Groq from "groq-sdk";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { tenantId, messages } = body;

        if (!tenantId || !Array.isArray(messages)) {
            return NextResponse.json(
                { error: "Faltan campos requeridos: tenantId, messages (array)" },
                { status: 400 }
            );
        }

        // Resolve tenantId → sucursal_id
        let sucursalId = tenantId;
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId);
        if (!isUUID) {
            const { data: sucursal } = await supabaseAdmin
                .from("sucursales")
                .select("id")
                .ilike("slug", tenantId)
                .single();

            if (!sucursal) {
                return NextResponse.json(
                    { error: "Tenant no encontrado" },
                    { status: 404 }
                );
            }
            sucursalId = sucursal.id;
        }

        let insertedCount = 0;
        let transcriptionCount = 0;

        for (const msg of messages) {
            const { sender, text, fromMe, timestamp, audio, audioMime } = msg;
            if (!sender || timestamp === undefined) continue;

            const conversation = await getOrCreateConversation(sucursalId, sender);
            if (!conversation) continue;

            let finalMessageText = text || "";

            // Transcription for audio notes if they are in base64
            if (audio && (text === "[Nota de voz]" || !text)) {
                try {
                    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });
                    const buffer = Buffer.from(audio, "base64");
                    const ext = audioMime?.includes("mp3") ? "mp3" : "ogg";
                    const file = new File([buffer], `audio.${ext}`, { type: audioMime || "audio/ogg; codecs=opus" });

                    const transcription = await groq.audio.transcriptions.create({
                        file: file,
                        model: "whisper-large-v3",
                        language: "es"
                    });

                    if (transcription.text) {
                        finalMessageText = `[Nota de voz] ${transcription.text}`;
                        transcriptionCount++;
                    }
                } catch (err: any) {
                    console.error("[Sync History Audio Transcribe Error]:", err.message || err);
                    finalMessageText = text || "[Nota de voz]";
                }
            }

            // Check if message already exists
            const createdAtDate = new Date(timestamp);
            const timeISO = createdAtDate.toISOString();
            const timeMin = new Date(timestamp - 5000).toISOString();
            const timeMax = new Date(timestamp + 5000).toISOString();

            const { data: existing } = await supabaseAdmin
                .from("whatsapp_messages")
                .select("id")
                .eq("sender_phone", sender)
                .eq("message_text", finalMessageText)
                .gte("created_at", timeMin)
                .lte("created_at", timeMax)
                .limit(1);

            if (existing && existing.length > 0) {
                continue; // Skip duplicates
            }

            // Insert message
            const { error: insertErr } = await supabaseAdmin
                .from("whatsapp_messages")
                .insert({
                    conversation_id: conversation.id,
                    sucursal_id: sucursalId,
                    sender_phone: sender,
                    message_text: fromMe ? "" : finalMessageText,
                    reply_text: fromMe ? finalMessageText : null,
                    from_me: fromMe,
                    processed: true,
                    created_at: timeISO
                });

            if (!insertErr) {
                insertedCount++;
            } else {
                console.error("[Sync History Insert Error]:", insertErr.message);
            }
        }

        return NextResponse.json({
            success: true,
            totalProcessed: messages.length,
            inserted: insertedCount,
            transcribed: transcriptionCount
        });
    } catch (error: any) {
        console.error("[sync-history] Error:", error.message);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
