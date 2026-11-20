/**
 * whatsappTrainer.ts
 *
 * Extrae el estilo humano real de comunicación, ejemplos few-shot y
 * conocimiento operativo a partir de:
 *   1) Historial de WhatsApp ya sincronizado en `whatsapp_messages`
 *   2) Archivos `.txt` exportados directamente desde WhatsApp
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
    callGeminiGenerateContent,
    callOpenAIChatCompletion,
    logTokenUsage,
} from "@/lib/aiProviders";

export interface FewShotExample {
    id: string;
    situation: string;
    customer: string;
    reply: string;
}

export interface ParsedWaMessage {
    timestamp: string;
    author: string;
    text: string;
    isBusiness?: boolean;
}

export interface DetectedAuthor {
    name: string;
    count: number;
}

export interface ParseTxtResult {
    messages: ParsedWaMessage[];
    authors: DetectedAuthor[];
    detectedBusinessAuthors: string[];
    skippedSystemCount: number;
}

export interface TrainingExtractionResult {
    style_guide: string;
    few_shot_examples: FewShotExample[];
    suggested_snippets: Array<{ id: string; title: string; content: string }>;
    summary: string;
    stats: {
        total_messages_analyzed: number;
        conversations_analyzed: number;
        business_replies_found: number;
    };
}

export interface SyncedStatsResult {
    totalMessages: number;
    humanBusinessReplies: number;
    customerMessages: number;
    conversationsWithHumanReplies: number;
}

const ANDROID_LINE_RE =
    /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:[\s\u00a0\u202f]*(?:a\.?\s*m\.?|p\.?\s*m\.?|AM|PM))?)\s*[-–]\s*([^:]+?):\s*(.*)$/i;

const IOS_LINE_RE =
    /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:[\s\u00a0\u202f]*(?:a\.?\s*m\.?|p\.?\s*m\.?|AM|PM))?)\]\s*([^:]+?):\s*(.*)$/i;

const SYSTEM_DATE_NO_AUTHOR_RE =
    /^(?:\[?\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?(?:[\s\u00a0\u202f]*(?:a\.?\s*m\.?|p\.?\s*m\.?|AM|PM))?\]?\s*[-–]?\s*)/i;

const SKIPPED_CONTENT_PATTERNS: RegExp[] = [
    /^<multimedia omitido>$/i,
    /^<media omitted>$/i,
    /^imagen omitida$/i,
    /^image omitted$/i,
    /^audio omitido$/i,
    /^audio omitted$/i,
    /^video omitido$/i,
    /^video omitted$/i,
    /^sticker omitido$/i,
    /^sticker omitted$/i,
    /^documento omitido$/i,
    /^document omitted$/i,
    /^gif omitido$/i,
    /^se elimin[oó] este mensaje\.?$/i,
    /^eliminaste este mensaje\.?$/i,
    /^this message was deleted\.?$/i,
    /^you deleted this message\.?$/i,
    /^llamada perdida/i,
    /^videollamada perdida/i,
    /^missed (?:voice |video )?call/i,
    /^\[nota de voz\]$/i,
    /^\[nota de voz \(expirada\)\]$/i,
    /cifrad[oa]s? de extremo a extremo/i,
    /end-to-end encrypted/i,
    /cambi[oó] su c[oó]digo de seguridad/i,
    /se unió usando el enlace/i,
    /creaste este grupo/i,
];

function isLegacyBotReply(text: string): boolean {
    const t = text.trim();
    return t.startsWith("🤖 ") || t.startsWith("⚡ ");
}

function shouldSkipLineContent(text: string): boolean {
    const clean = text.replace(/[\u200e\u200f\ufeff]/g, "").trim();
    if (!clean) return true;
    return SKIPPED_CONTENT_PATTERNS.some((re) => re.test(clean));
}

/**
 * Enmascara teléfonos, emails y CBU/CVU para no filtrar datos privados en ejemplos/prompts.
 */
export function anonymizeSensitiveText(text: string): string {
    if (!text) return "";
    return text
        // Emails
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
        // CBU / CVU (18 a 22 dígitos seguidos)
        .replace(/\b\d{18,22}\b/g, "[cbu]")
        // Teléfonos internacionales o locales con al menos 9 dígitos (evita tocar precios $12.500 o horas 20:30)
        .replace(/(?<!\$)(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{1,4}\)?[\s.-]?){1,3}\d{3,4}[\s.-]?\d{4}\b/g, (match) => {
            const digits = match.replace(/\D/g, "");
            return digits.length >= 9 ? "[teléfono]" : match;
        });
}

/**
 * Parsea el contenido de un archivo `.txt` exportado desde WhatsApp (Android o iOS).
 */
export function parseWhatsAppExportTxt(
    content: string,
    businessNames: string[] = []
): ParseTxtResult {
    const normalized = (content || "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/[\u200e\u200f\ufeff]/g, "");

    const normalizedBizSet = new Set(
        businessNames.map((n) => n.trim().toLowerCase()).filter(Boolean)
    );

    const lines = normalized.split("\n");
    const messages: ParsedWaMessage[] = [];
    const authorCounts = new Map<string, number>();
    let skippedSystemCount = 0;

    for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        if (!line.trim()) continue;

        const m = line.match(ANDROID_LINE_RE) || line.match(IOS_LINE_RE);
        if (m) {
            const datePart = m[1].trim();
            const timePart = m[2].replace(/[\u00a0\u202f]/g, " ").trim();
            const author = m[3].trim();
            const body = m[4].trim();

            if (shouldSkipLineContent(body)) {
                skippedSystemCount++;
                continue;
            }

            const isBusiness = normalizedBizSet.has(author.toLowerCase());
            messages.push({
                timestamp: `${datePart} ${timePart}`,
                author,
                text: body,
                isBusiness,
            });
            authorCounts.set(author, (authorCounts.get(author) || 0) + 1);
            continue;
        }

        // Línea que empieza con fecha pero sin "Autor: mensaje" -> aviso del sistema de WhatsApp
        if (SYSTEM_DATE_NO_AUTHOR_RE.test(line)) {
            skippedSystemCount++;
            continue;
        }

        // Continuación multilínea del mensaje anterior
        if (messages.length > 0 && !shouldSkipLineContent(line)) {
            const last = messages[messages.length - 1];
            last.text = `${last.text}\n${line.trim()}`;
        }
    }

    const authors: DetectedAuthor[] = Array.from(authorCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

    const detectedBusinessAuthors = authors
        .filter((a) => normalizedBizSet.has(a.name.toLowerCase()))
        .map((a) => a.name);

    return {
        messages,
        authors,
        detectedBusinessAuthors,
        skippedSystemCount,
    };
}

/**
 * Devuelve estadísticas rápidas de los mensajes reales sincronizados en Supabase para esta sucursal.
 */
export async function getSyncedWhatsAppStats(sucursalId: string): Promise<SyncedStatsResult> {
    const { data, error } = await supabaseAdmin
        .from("whatsapp_messages")
        .select("conversation_id, message_text, reply_text, from_me")
        .eq("sucursal_id", sucursalId)
        .order("created_at", { ascending: false })
        .limit(1000);

    if (error || !data) {
        return {
            totalMessages: 0,
            humanBusinessReplies: 0,
            customerMessages: 0,
            conversationsWithHumanReplies: 0,
        };
    }

    let humanBusinessReplies = 0;
    let customerMessages = 0;
    const convsWithHuman = new Set<string>();

    for (const row of data) {
        const msgText = (row.message_text || "").trim();
        const repText = (row.reply_text || "").trim();

        if (!row.from_me && msgText && !shouldSkipLineContent(msgText)) {
            customerMessages++;
        }
        if (repText && !isLegacyBotReply(repText) && !shouldSkipLineContent(repText)) {
            humanBusinessReplies++;
            if (row.conversation_id) {
                convsWithHuman.add(row.conversation_id);
            }
        }
    }

    return {
        totalMessages: data.length,
        humanBusinessReplies,
        customerMessages,
        conversationsWithHumanReplies: convsWithHuman.size,
    };
}

/**
 * Construye un transcript anonimizado con conversaciones reales de `whatsapp_messages`
 * ignorando respuestas viejas del bot (`🤖 ` / `⚡ `).
 */
export async function loadSyncedWhatsAppTranscript(
    sucursalId: string,
    maxConversations: number = 30,
    maxMessages: number = 350,
    maxChars: number = 28000
): Promise<{
    transcript: string;
    stats: {
        total_messages_analyzed: number;
        conversations_analyzed: number;
        business_replies_found: number;
    };
}> {
    const { data, error } = await supabaseAdmin
        .from("whatsapp_messages")
        .select("conversation_id, sender_phone, message_text, reply_text, from_me, created_at")
        .eq("sucursal_id", sucursalId)
        .order("created_at", { ascending: false })
        .limit(maxMessages);

    if (error || !data || data.length === 0) {
        return {
            transcript: "",
            stats: {
                total_messages_analyzed: 0,
                conversations_analyzed: 0,
                business_replies_found: 0,
            },
        };
    }

    // Orden cronológico (oldest -> newest)
    const rows = [...data].reverse();
    const convMap = new Map<string, Array<{ role: "Cliente" | "Negocio"; text: string }>>();

    for (const row of rows) {
        const convKey = row.conversation_id || row.sender_phone || "default";
        if (!convMap.has(convKey)) convMap.set(convKey, []);
        const list = convMap.get(convKey)!;

        const msgText = (row.message_text || "").trim();
        const repText = (row.reply_text || "").trim();

        if (row.from_me) {
            const cleanReply = repText || msgText;
            if (cleanReply && !isLegacyBotReply(cleanReply) && !shouldSkipLineContent(cleanReply)) {
                list.push({ role: "Negocio", text: anonymizeSensitiveText(cleanReply) });
            }
        } else {
            if (msgText && !shouldSkipLineContent(msgText)) {
                list.push({ role: "Cliente", text: anonymizeSensitiveText(msgText) });
            }
            if (repText && !isLegacyBotReply(repText) && !shouldSkipLineContent(repText)) {
                list.push({ role: "Negocio", text: anonymizeSensitiveText(repText) });
            }
        }
    }

    // Priorizar conversaciones donde haya al menos 1 respuesta humana del negocio y 1 del cliente
    const validConvs = Array.from(convMap.values()).filter(
        (turns) =>
            turns.some((t) => t.role === "Negocio") &&
            turns.some((t) => t.role === "Cliente")
    );

    const selectedConvs = validConvs.slice(-maxConversations);
    const blocks: string[] = [];
    let totalChars = 0;
    let totalMessages = 0;
    let businessReplies = 0;
    let conversationsAnalyzed = 0;

    for (let i = 0; i < selectedConvs.length; i++) {
        const turns = selectedConvs[i];
        const lines = [`--- Conversación ${i + 1} ---`];
        let convBizCount = 0;
        for (const t of turns) {
            const clipped = t.text.length > 450 ? `${t.text.slice(0, 450)}...` : t.text;
            lines.push(`${t.role}: ${clipped}`);
            if (t.role === "Negocio") convBizCount++;
        }
        const block = lines.join("\n");
        if (totalChars + block.length > maxChars && blocks.length > 0) {
            break;
        }
        blocks.push(block);
        totalChars += block.length + 2;
        totalMessages += turns.length;
        businessReplies += convBizCount;
        conversationsAnalyzed++;
    }

    return {
        transcript: blocks.join("\n\n"),
        stats: {
            total_messages_analyzed: totalMessages,
            conversations_analyzed: conversationsAnalyzed,
            business_replies_found: businessReplies,
        },
    };
}

/**
 * Arma un transcript anonimizado desde uno o varios archivos `.txt` exportados de WhatsApp.
 */
export function buildTranscriptFromExports(
    rawTexts: string[],
    businessNames: string[],
    maxChars: number = 30000
): {
    transcript: string;
    stats: {
        total_messages_analyzed: number;
        conversations_analyzed: number;
        business_replies_found: number;
    };
} {
    const blocks: string[] = [];
    let totalChars = 0;
    let totalMessages = 0;
    let businessReplies = 0;
    let conversationsAnalyzed = 0;

    for (let idx = 0; idx < rawTexts.length; idx++) {
        const raw = rawTexts[idx];
        if (!raw || !raw.trim()) continue;

        const parsed = parseWhatsAppExportTxt(raw, businessNames);
        if (parsed.messages.length === 0) continue;

        // Tomar los últimos ~180 mensajes del archivo (estilo más reciente)
        const recent = parsed.messages.slice(-180);
        const lines: string[] = [`--- Chat Exportado ${idx + 1} ---`];
        let fileBizReplies = 0;
        let fileMsgs = 0;

        for (const msg of recent) {
            if (isLegacyBotReply(msg.text)) continue;
            const roleLabel = msg.isBusiness ? "Negocio" : `Cliente (${msg.author})`;
            const clean = anonymizeSensitiveText(msg.text);
            const clipped = clean.length > 450 ? `${clean.slice(0, 450)}...` : clean;
            lines.push(`${roleLabel}: ${clipped}`);
            fileMsgs++;
            if (msg.isBusiness) fileBizReplies++;
        }

        const block = lines.join("\n");
        if (totalChars + block.length > maxChars) {
            const remaining = maxChars - totalChars;
            if (remaining > 800) {
                blocks.push(block.slice(-remaining));
                totalMessages += fileMsgs;
                businessReplies += fileBizReplies;
                conversationsAnalyzed++;
            }
            break;
        }

        blocks.push(block);
        totalChars += block.length + 2;
        totalMessages += fileMsgs;
        businessReplies += fileBizReplies;
        conversationsAnalyzed++;
    }

    return {
        transcript: blocks.join("\n\n"),
        stats: {
            total_messages_analyzed: totalMessages,
            conversations_analyzed: conversationsAnalyzed,
            business_replies_found: businessReplies,
        },
    };
}

function cleanJsonString(rawText: string): string {
    const trimmed = rawText.trim();
    if (trimmed.startsWith("```")) {
        return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    }
    return trimmed;
}

/**
 * Usa IA para destilar la guía de estilo, ejemplos few-shot y snippets FAQ
 * a partir de conversaciones reales de WhatsApp.
 */
export async function distillStyleAndKnowledge(params: {
    sucursalId: string;
    sucursalName: string;
    transcript: string;
    stats: {
        total_messages_analyzed: number;
        conversations_analyzed: number;
        business_replies_found: number;
    };
}): Promise<TrainingExtractionResult> {
    if (!params.transcript.trim()) {
        throw new Error("No hay suficientes conversaciones con respuestas reales del negocio para analizar.");
    }

    const systemInstruction = `Sos un especialista en diseño de asistentes conversacionales para comercios gastronómicos en Argentina.
Tu tarea es analizar chats reales de WhatsApp de "${params.sucursalName}" y extraer exactamente cómo atiende el equipo humano del local para que el chatbot responda igual de humano, cercano y natural.

REGLAS OBLIGATORIAS:
1. Devolvé ÚNICAMENTE un JSON válido con la estructura exacta solicitada.
2. En "style_guide" (máximo 1200 caracteres): describí el tono real observado:
   - Cómo saluda y se despide el local (ej: "Holaa! Cómo va?", "Dale genio", "Ahí te paso", etc.).
   - Uso de voseo argentino, modismos locales, nivel de formalidad y uso de emojis (cuáles usa y con qué frecuencia).
   - Largo típico de mensajes y estructura al tomar un pedido o confirmar demora.
3. En "few_shot_examples" (entre 6 y 12 ejemplos): seleccioná o sintetizá intercambios reales representativos (saludo, consulta de menú/recomendación, pedido con envío/retiro, consulta de demora, forma de pago, cierre).
   - CRÍTICO: NUNCA dejes precios numéricos viejos ni fechas puntuales en los ejemplos. Si en el chat original aparecía un precio, reemplazalo por "[precio actual]" o enfocá el ejemplo en el estilo de respuesta. Los precios reales siempre los consulta el bot desde la base de datos.
   - CRÍTICO: No incluyas nombres propios privados ni teléfonos/CBU en los ejemplos.
4. En "suggested_snippets" (entre 0 y 8 snippets): solo políticas operativas, horarios, demoras promedio, zonas o aclaraciones recurrentes que aparezcan explícitamente en los chats. NO inventes nada que no esté en los chats.
5. En "summary": un resumen claro y breve en español (2-4 líneas) explicando qué estilo detectaste.

ESQUEMA JSON EXACTO:
{
  "summary": "string",
  "style_guide": "string",
  "few_shot_examples": [
    { "situation": "string", "customer": "string", "reply": "string" }
  ],
  "suggested_snippets": [
    { "title": "string", "content": "string" }
  ]
}`;

    const userPrompt = `Analizá estas conversaciones reales de WhatsApp del negocio "${params.sucursalName}" y generá el JSON de entrenamiento:\n\n${params.transcript}`;

    let rawJsonText = "";

    try {
        const res = await callGeminiGenerateContent({
            model: "gemini-2.5-flash",
            systemInstruction,
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            maxOutputTokens: 2500,
            temperature: 0.3,
            responseMimeType: "application/json",
            thinkingBudget: 0,
        });
        rawJsonText = res.text;
        await logTokenUsage(params.sucursalId, "training", res.usage);
    } catch (geminiErr: any) {
        if (process.env.OPENAI_API_KEY?.trim()) {
            const res = await callOpenAIChatCompletion({
                model: "gpt-4.1-mini",
                messages: [
                    { role: "system", content: systemInstruction },
                    { role: "user", content: userPrompt },
                ],
                maxTokens: 2500,
                temperature: 0.3,
                responseFormat: { type: "json_object" },
            });
            rawJsonText = res.message?.content || "";
            await logTokenUsage(params.sucursalId, "training", res.usage);
        } else {
            throw geminiErr;
        }
    }

    const parsed = JSON.parse(cleanJsonString(rawJsonText || "{}"));
    const nowId = Date.now();

    const fewShotExamples: FewShotExample[] = Array.isArray(parsed.few_shot_examples)
        ? parsed.few_shot_examples
              .filter((e: any) => e && e.customer && e.reply)
              .slice(0, 12)
              .map((e: any, i: number) => ({
                  id: `ex-${nowId}-${i}`,
                  situation: String(e.situation || "Conversación").trim(),
                  customer: String(e.customer).trim(),
                  reply: String(e.reply).trim(),
              }))
        : [];

    const suggestedSnippets = Array.isArray(parsed.suggested_snippets)
        ? parsed.suggested_snippets
              .filter((s: any) => s && s.title && s.content)
              .slice(0, 8)
              .map((s: any, i: number) => ({
                  id: `snip-${nowId}-${i}`,
                  title: String(s.title).trim(),
                  content: String(s.content).trim(),
              }))
        : [];

    return {
        summary: String(parsed.summary || "Análisis completado.").trim(),
        style_guide: String(parsed.style_guide || "").trim(),
        few_shot_examples: fewShotExamples,
        suggested_snippets: suggestedSnippets,
        stats: params.stats,
    };
}
