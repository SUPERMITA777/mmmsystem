import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
    try {
        const content = readFileSync(join(__dirname, "..", ".env"), "utf-8");
        content.split("\n").forEach(line => {
            const t = line.trim().replace(/\r$/, "");
            if (!t || t.startsWith("#")) return;
            const idx = t.indexOf("=");
            if (idx < 0) return;
            process.env[t.slice(0, idx).trim()] ??= t.slice(idx + 1).trim();
        });
    } catch { }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !GEMINI_API_KEY) {
    console.error("❌ Faltan variables de entorno esenciales en .env (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY)");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function main() {
    const slug = process.argv[2];
    if (!slug) {
        console.error("❌ Por favor especifica el slug de la sucursal. Ejemplo: node scripts/analizar-inconsistencias.mjs mmm");
        process.exit(1);
    }

    console.log(`🔍 Buscando sucursal con slug: ${slug}...`);
    const { data: sucursal, error: sucErr } = await supabase
        .from("sucursales")
        .select("id, nombre")
        .ilike("slug", slug)
        .single();

    if (sucErr || !sucursal) {
        console.error(`❌ Sucursal no encontrada para el slug: ${slug}`);
        process.exit(1);
    }

    const sucursalId = sucursal.id;
    console.log(`✅ Sucursal encontrada: ${sucursal.nombre} (${sucursalId})`);

    // Fetch messages from last 60 days
    const sixtyDaysAgo = new Date(Date.now() - (60 * 24 * 60 * 60 * 1000)).toISOString();
    console.log(`📥 Cargando historial de mensajes desde ${new Date(sixtyDaysAgo).toLocaleDateString()}...`);
    
    const { data: messages, error: msgErr } = await supabase
        .from("whatsapp_messages")
        .select("conversation_id, sender_phone, message_text, reply_text, from_me, created_at")
        .eq("sucursal_id", sucursalId)
        .gte("created_at", sixtyDaysAgo)
        .order("conversation_id", { ascending: true })
        .order("created_at", { ascending: true });

    if (msgErr) {
        console.error(`❌ Error al obtener mensajes de WhatsApp:`, msgErr.message);
        process.exit(1);
    }

    if (!messages || messages.length === 0) {
        console.log(`ℹ️ No se encontraron mensajes en los últimos 2 meses para esta sucursal.`);
        process.exit(0);
    }

    console.log(`📊 Se encontraron ${messages.length} mensajes. Agrupando por conversación...`);

    // Group messages by conversation ID
    const conversations = {};
    for (const m of messages) {
        if (!conversations[m.conversation_id]) {
            conversations[m.conversation_id] = {
                phone: m.sender_phone,
                log: []
            };
        }
        const timeStr = new Date(m.created_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
        if (m.from_me) {
            conversations[m.conversation_id].log.push(`[${timeStr}] Personal/Asistente: ${m.reply_text}`);
        } else {
            conversations[m.conversation_id].log.push(`[${timeStr}] Cliente: ${m.message_text}`);
        }
    }

    const conversationIds = Object.keys(conversations);
    console.log(`💬 Se detectaron ${conversationIds.length} conversaciones únicas.`);

    // Build the transcript text
    let transcriptText = "";
    let count = 0;
    for (const id of conversationIds) {
        count++;
        transcriptText += `\n--- CONVERSACIÓN #${count} (Cliente: ${conversations[id].phone}) ---\n`;
        transcriptText += conversations[id].log.join("\n");
        transcriptText += "\n";
    }

    console.log(`🧠 Enviando transcripciones de chats a Gemini para análisis...`);

    const prompt = `Analizá las siguientes conversaciones reales entre clientes y el personal/asistente del restaurante "mmm pizza" de los últimos 2 meses.

Conversaciones:
${transcriptText}

Por favor, realizá dos tareas:

1. **Preguntas Frecuentes (FAQs)**: Extraé las preguntas más comunes que hacen los clientes (ej. horarios, formas de pago, delivery, costo de envío, promociones) junto con la respuesta correcta que debería responder el bot según la información provista por el personal. Formatealo como una lista estructurada de pares Pregunta/Respuesta.
2. **Inconsistencias y Contradicciones**: Identificá respuestas dadas al cliente por parte del personal humano o versiones anteriores del bot que sean contradictorias, confusas, erróneas o inconsistentes (ej. diferentes precios informados para el mismo producto o costo de envío, horarios que no coinciden, respuestas vagas, etc.).

Devolvé el resultado estructurado en el siguiente formato JSON estricto:
{
  "faqs": [
    { "pregunta": "...", "respuesta": "..." }
  ],
  "inconsistencias": [
    { "descripcion": "...", "ejemplo": "...", "sugerencia_mejora": "..." }
  ]
}
`;

    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        const res = await model.generateContent(prompt);
        const resultText = res.response.text();
        const analysis = JSON.parse(resultText);

        console.log(`✅ Análisis completo. FAQs encontradas: ${analysis.faqs?.length || 0}. Inconsistencias: ${analysis.inconsistencias?.length || 0}`);

        // 1. Save FAQs as a Training Snippet in config_sucursal
        console.log(`💾 Actualizando Snippet de Entrenamiento en config_sucursal...`);
        const { data: configData, error: configErr } = await supabase
            .from("config_sucursal")
            .select("ai_agent_config")
            .eq("sucursal_id", sucursalId)
            .maybeSingle();

        if (configErr) {
            console.error("❌ Error al obtener configuración de sucursal:", configErr.message);
        } else {
            const currentConfig = configData?.ai_agent_config || {
                enabled: true,
                whatsapp_enabled: true,
                system_prompt: "",
                training_snippets: [],
                allowed_operations: [],
                auto_reply: true,
                business_hours_only: false,
                max_tokens: 1000,
                agent_name: "Pizzy",
                personality_modes: [],
                active_personality: "default",
                handoff_triggers: [],
                resume_triggers: []
            };

            const faqsMd = (analysis.faqs || []).map(faq => `**P:** ${faq.pregunta}\n**R:** ${faq.respuesta}`).join("\n\n");
            
            // Find or create snippet
            let snippets = currentConfig.training_snippets || [];
            const existingIndex = snippets.findIndex(s => s.id === "faq-historical-sync");
            const newSnippet = {
                id: "faq-historical-sync",
                title: "Preguntas Frecuentes (Historial 2 Meses)",
                content: faqsMd
            };

            if (existingIndex >= 0) {
                snippets[existingIndex] = newSnippet;
            } else {
                snippets.push(newSnippet);
            }

            currentConfig.training_snippets = snippets;

            const { error: updateErr } = await supabase
                .from("config_sucursal")
                .update({ ai_agent_config: currentConfig })
                .eq("sucursal_id", sucursalId);

            if (updateErr) {
                console.error("❌ Error al actualizar config_sucursal:", updateErr.message);
            } else {
                console.log("✅ Snippet de entrenamiento de FAQs guardado con éxito.");
            }
        }

        // 2. Generate detailed Markdown Report
        const reportPath = "C:/Users/emanu/.gemini/antigravity/brain/317958e4-adf0-42fb-bc2b-bc9350e77ba3/reporte_inconsistencias.md";
        console.log(`📝 Escribiendo reporte en: ${reportPath}...`);

        let reportMd = `# Reporte de Análisis de Historial: Sucursal "${sucursal.nombre}"\n\n`;
        reportMd += `> [!NOTE]\n`;
        reportMd += `> Este reporte fue generado automáticamente analizando las conversaciones de los últimos 2 meses para identificar inconsistencias y extraer preguntas frecuentes (FAQs).\n\n`;

        reportMd += `## ❓ Preguntas Frecuentes Destiladas (Guardadas para el Agente)\n`;
        reportMd += `Estas preguntas y respuestas se guardaron automáticamente en los fragmentos de entrenamiento de la IA para unificar las respuestas futuras:\n\n`;

        (analysis.faqs || []).forEach((faq, i) => {
            reportMd += `### ${i + 1}. ${faq.pregunta}\n`;
            reportMd += `**Respuesta sugerida:** ${faq.respuesta}\n\n`;
        });

        reportMd += `## ⚠️ Inconsistencias y Respuestas a Mejorar Detectadas\n`;
        reportMd += `Se identificaron las siguientes discrepancias o respuestas confusas dadas a los clientes. Es recomendable revisar estos puntos para alinear la información:\n\n`;

        if ((analysis.inconsistencias || []).length === 0) {
            reportMd += `*¡No se detectaron inconsistencias significativas en las respuestas dadas! Excelente consistencia.*`;
        } else {
            (analysis.inconsistencias || []).forEach((inc, i) => {
                reportMd += `### ⚠️ Discrepancia ${i + 1}: ${inc.descripcion}\n`;
                reportMd += `* **Ejemplo detectado en chat:** *"${inc.ejemplo}"*\n`;
                reportMd += `* **Sugerencia de alineación/mejora:** ${inc.sugerencia_mejora}\n\n`;
            });
        }

        writeFileSync(reportPath, reportMd, "utf-8");
        console.log(`🎉 ¡Análisis finalizado y guardado con éxito!`);
    } catch (err) {
        console.error("❌ Error durante el análisis con la IA:", err.message || err);
    }
}

main();
