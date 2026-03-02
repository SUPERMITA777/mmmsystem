/**
 * commandParser.ts
 * 
 * Motor NLP híbrido: usa Groq (Llama 3.3 70B) cuando está disponible,
 * y cae al parser regex local si Groq falla.
 */

import Groq from "groq-sdk";

export type CommandIntent =
    | "disable_product"
    | "enable_product"
    | "price_increase_percent"
    | "price_decrease_percent"
    | "price_increase_fixed"
    | "price_decrease_fixed"
    | "price_set"
    | "apply_discount"
    | "rename"
    | "hide_menu"
    | "show_menu"
    | "disable_category"
    | "enable_category";

export interface ParsedCommand {
    intent: CommandIntent;
    targetName: string;
    value?: number;
    newName?: string;
    targetType: "producto" | "categoria";
}

export interface ParseResult {
    success: boolean;
    command?: ParsedCommand;
    error?: string;
}

// ═══════════════════════════════════════════════════
// GROQ AI PARSER (Llama 3.3 70B)
// ═══════════════════════════════════════════════════

const SYSTEM_PROMPT = `Eres un asistente experto en gestión de menús de restaurantes.
Convierte comandos en español a JSON estructurado.

REGLAS CRÍTICAS:
1. "targetName" debe contener SOLO el nombre del producto o categoría, SIN calificadores ni instrucciones adicionales.
2. Si el usuario agrega texto extra como "tanto productos como adicionales", "de todos los tipos", "que están activos", etc., IGNORALO — no es parte del nombre.
3. Si el comando menciona varias acciones, enfocate en la acción principal.

Intents posibles:
- "disable_product": Desactivar producto
- "enable_product": Activar producto
- "price_increase_percent": Aumentar precio por porcentaje
- "price_decrease_percent": Disminuir precio por porcentaje
- "price_increase_fixed": Aumentar precio monto fijo ($)
- "price_decrease_fixed": Disminuir precio monto fijo ($)
- "price_set": Establecer precio exacto
- "apply_discount": Aplicar descuento (bajar precio X%)
- "rename": Cambiar nombre
- "hide_menu": Ocultar del menú
- "show_menu": Mostrar en menú
- "disable_category": Desactivar categoría
- "enable_category": Activar categoría

Formato JSON:
{"intent":"...","targetName":"...","targetType":"producto"|"categoria","value":number,"newName":"..."}

Ejemplos:
"baja el precio de las empanadas un 10%" -> {"intent":"price_decrease_percent","targetName":"empanadas","targetType":"producto","value":10}
"deshabilita la categoría pizzas" -> {"intent":"disable_category","targetName":"pizzas","targetType":"categoria"}
"ponele un descuento del 15% a las burgers" -> {"intent":"apply_discount","targetName":"burgers","targetType":"producto","value":15}
"aumenta el precio de las empanadas $500" -> {"intent":"price_increase_fixed","targetName":"empanadas","targetType":"producto","value":500}
"la pizza grande cuesta $5000" -> {"intent":"price_set","targetName":"pizza grande","targetType":"producto","value":5000}
"cambia el nombre de coca a coca cola zero" -> {"intent":"rename","targetName":"coca","targetType":"producto","newName":"coca cola zero"}
"deshabilita las empanadas de carne, tanto productos como adicionales" -> {"intent":"disable_product","targetName":"empanadas de carne","targetType":"producto"}
"aumenta todo un 20%" -> {"intent":"price_increase_percent","targetName":"todo","targetType":"producto","value":20}

Responde SOLO el JSON, sin texto extra.`;

async function parseWithAI(input: string): Promise<ParseResult> {
    if (!process.env.GROQ_API_KEY) {
        return { success: false, error: "NO_API_KEY" };
    }

    try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: input }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0,
            max_tokens: 200,
            response_format: { type: "json_object" },
        });

        const text = completion.choices[0]?.message?.content;
        if (!text) throw new Error("Empty response from Groq");

        const parsed = JSON.parse(text);
        return { success: true, command: parsed as ParsedCommand };
    } catch (error: any) {
        console.warn("Groq parser failed, falling back to regex:", error.message);
        return { success: false, error: error.message };
    }
}

// ═══════════════════════════════════════════════════
// REGEX FALLBACK PARSER
// ═══════════════════════════════════════════════════

function cleanEntityName(name: string): string {
    return name
        .replace(/^(el|la|los|las|un|una|unos|unas|al|del|de la|de los|de las)\s+/gi, "")
        .replace(/\s+(del|de la|de los|de las|en el|en la|del menu|del menú)\s*$/gi, "")
        .trim();
}

interface PatternDef {
    regex: RegExp;
    intent: CommandIntent;
    targetType: "producto" | "categoria";
    extractTarget: (match: RegExpMatchArray) => string;
    extractValue?: (match: RegExpMatchArray) => number | undefined;
    extractNewName?: (match: RegExpMatchArray) => string | undefined;
}

const patterns: PatternDef[] = [
    // ── DISCOUNT / DESCUENTO ──
    {
        regex: /(?:descuento|oferta|promo|rebaja|rebajá)\s+(?:del?\s+)?([\d.,]+)\s*%\s+(?:a\s+(?:las?\s+|los?\s+|la\s+|el\s+)?)?(.+)/i,
        intent: "apply_discount",
        targetType: "producto",
        extractTarget: (m) => m[2],
        extractValue: (m) => parseFloat(m[1].replace(",", ".")),
    },
    {
        regex: /(?:ponele|poné|aplica|aplicá|hace|hacé|haz)\s+(?:un\s+)?(?:descuento|oferta|promo)\s+(?:del?\s+)?([\d.,]+)\s*%\s+(?:a\s+(?:las?\s+|los?\s+|la\s+|el\s+)?)?(.+)/i,
        intent: "apply_discount",
        targetType: "producto",
        extractTarget: (m) => m[2],
        extractValue: (m) => parseFloat(m[1].replace(",", ".")),
    },
    // ── PRICE INCREASE PERCENT ──
    {
        regex: /(?:aumenta|subi|subí|subile|incrementa|incrementá|aumentá)\s+(?:el\s+precio\s+(?:de\s+)?)?(?:las?\s+|los?\s+|la\s+|el\s+)?(.+?)\s+(?:un\s+)?([\d.,]+)\s*%/i,
        intent: "price_increase_percent",
        targetType: "producto",
        extractTarget: (m) => m[1],
        extractValue: (m) => parseFloat(m[2].replace(",", ".")),
    },
    // ── PRICE DECREASE PERCENT ──
    {
        regex: /(?:baja|bajá|bajale|reduce|reducí|rebaja|rebajá|disminui|disminuí)\s+(?:el\s+precio\s+(?:de\s+)?)?(?:las?\s+|los?\s+|la\s+|el\s+)?(.+?)\s+(?:un\s+)?([\d.,]+)\s*%/i,
        intent: "price_decrease_percent",
        targetType: "producto",
        extractTarget: (m) => m[1],
        extractValue: (m) => parseFloat(m[2].replace(",", ".")),
    },
    // ── PRICE INCREASE FIXED ($) ──
    {
        regex: /(?:aumenta|subi|subí|subile|incrementa|incrementá|aumentá)\s+(?:el\s+precio\s+(?:de\s+)?)?(?:las?\s+|los?\s+|la\s+|el\s+)?(.+?)\s+(?:un\s+)?\$\s*([\d.,]+)/i,
        intent: "price_increase_fixed",
        targetType: "producto",
        extractTarget: (m) => m[1],
        extractValue: (m) => parseFloat(m[2].replace(",", ".")),
    },
    // ── PRICE DECREASE FIXED ($) ──
    {
        regex: /(?:baja|bajá|bajale|reduce|reducí|rebaja|rebajá|disminui|disminuí)\s+(?:el\s+precio\s+(?:de\s+)?)?(?:las?\s+|los?\s+|la\s+|el\s+)?(.+?)\s+(?:un\s+)?\$\s*([\d.,]+)/i,
        intent: "price_decrease_fixed",
        targetType: "producto",
        extractTarget: (m) => m[1],
        extractValue: (m) => parseFloat(m[2].replace(",", ".")),
    },
    // ── PRICE SET ──
    {
        regex: /(?:ponele|poné|pon|setea|seteá|fija|fijá|cambia|cambiá)\s+(?:el\s+precio\s+(?:de\s+)?)?(?:a\s+)?\$?\s*([\d.,]+)\s+(?:a\s+(?:la\s+|el\s+)?)?(.+)/i,
        intent: "price_set",
        targetType: "producto",
        extractTarget: (m) => m[2],
        extractValue: (m) => parseFloat(m[1].replace(",", ".")),
    },
    {
        regex: /(?:ponele|poné|pon|setea|seteá|fija|fijá|cambia|cambiá)\s+(?:el\s+)?precio\s+(?:de\s+(?:la\s+|el\s+)?)?(.+?)\s+(?:a|en)\s+\$?\s*([\d.,]+)/i,
        intent: "price_set",
        targetType: "producto",
        extractTarget: (m) => m[1],
        extractValue: (m) => parseFloat(m[2].replace(",", ".")),
    },
    // ── RENAME ──
    {
        regex: /(?:cambia|cambiale|cambiá|renombra|renombrá)\s+(?:el\s+)?nombre\s+(?:de\s+(?:la\s+|el\s+)?)?(.+?)\s+(?:a|por)\s+(.+)/i,
        intent: "rename",
        targetType: "producto",
        extractTarget: (m) => m[1],
        extractNewName: (m) => m[2],
    },
    // ── CATEGORY DISABLE/ENABLE ──
    {
        regex: /(?:deshabilita|desactiva|deshabilitá|desactivá)\s+(?:la\s+)?categor[ií]a\s+(.+)/i,
        intent: "disable_category",
        targetType: "categoria",
        extractTarget: (m) => m[1],
    },
    {
        regex: /(?:habilita|activa|habilitá|activá)\s+(?:la\s+)?categor[ií]a\s+(.+)/i,
        intent: "enable_category",
        targetType: "categoria",
        extractTarget: (m) => m[1],
    },
    // ── HIDE/SHOW IN MENU ──
    {
        regex: /(?:oculta|ocultá|esconde|escondé|sacá|saca)\s+(?:de?\s+menú?\s+)?(?:las?\s+|los?\s+|la\s+|el\s+)?(.+?)(?:\s+de?\s+menú?)?$/i,
        intent: "hide_menu",
        targetType: "producto",
        extractTarget: (m) => m[1],
    },
    {
        regex: /(?:mostra|mostrá|mostrar|agrega|agregá)\s+(?:en\s+(?:el\s+)?menú?\s+)?(?:las?\s+|los?\s+|la\s+|el\s+)?(.+?)(?:\s+(?:en|al)\s+(?:el\s+)?menú?)?$/i,
        intent: "show_menu",
        targetType: "producto",
        extractTarget: (m) => m[1],
    },
    // ── DISABLE/ENABLE PRODUCT ──
    {
        regex: /(?:deshabilita|desactiva|deshabilitá|desactivá|inhabilita|inhabilitá|apaga|apagá)\s+(?:el\s+producto\s+)?(?:las?\s+|los?\s+|la\s+|el\s+)?(.+)/i,
        intent: "disable_product",
        targetType: "producto",
        extractTarget: (m) => m[1],
    },
    {
        regex: /(?:habilita|activa|habilitá|activá|prende|prendé|enciende|encendé)\s+(?:el\s+producto\s+)?(?:las?\s+|los?\s+|la\s+|el\s+)?(.+)/i,
        intent: "enable_product",
        targetType: "producto",
        extractTarget: (m) => m[1],
    },
    // ── PRICE SET CATCH-ALL ──
    {
        regex: /^(?!(?:aumenta|subi|baja|oculta|mostra|cambia|deshabilita|habilita|renombra|ponele|setea|fija|pon|agreg|descuento|oferta)).+?\s+(?:a\s+)?\$\s*([\d.,]+)\s*$/i,
        intent: "price_set",
        targetType: "producto",
        extractTarget: (m) => m[0].split(/\s+(?:a\s+)?\$/)[0],
        extractValue: (m) => parseFloat(m[1].replace(",", ".")),
    },
];

function parseWithRegex(input: string): ParseResult {
    const trimmed = input.trim();
    if (!trimmed) return { success: false, error: "El comando está vacío." };

    for (const pattern of patterns) {
        const match = trimmed.match(pattern.regex);
        if (match) {
            const rawTarget = pattern.extractTarget(match);
            const targetName = cleanEntityName(rawTarget);
            if (!targetName) continue;

            const command: ParsedCommand = {
                intent: pattern.intent,
                targetName,
                targetType: pattern.targetType,
            };

            if (pattern.extractValue) command.value = pattern.extractValue(match);
            if (pattern.extractNewName) {
                const raw = pattern.extractNewName(match);
                command.newName = raw ? cleanEntityName(raw) : undefined;
            }

            return { success: true, command };
        }
    }

    return {
        success: false,
        error: "No pude entender el comando. Probá con frases como:\n• \"deshabilita empanadas de carne\"\n• \"aumenta las pizzas un 10%\"\n• \"descuento del 15% a las milanesas\"\n• \"ponele $5000 a la pizza grande\"",
    };
}

// ═══════════════════════════════════════════════════
// MAIN: HYBRID PARSER (Groq + Regex fallback)
// ═══════════════════════════════════════════════════

export async function parseCommand(input: string): Promise<ParseResult> {
    const trimmed = input.trim();
    if (!trimmed) return { success: false, error: "El comando está vacío." };

    // 1. Try Groq AI first
    const aiResult = await parseWithAI(trimmed);
    if (aiResult.success) {
        console.log("⚡ Parsed with Groq AI (Llama 3.3 70B)");
        return aiResult;
    }

    // 2. Fallback to regex
    console.log("🔄 Groq unavailable, using regex fallback");
    return parseWithRegex(trimmed);
}

// Human readable description of what the command does
export function describeCommand(cmd: ParsedCommand): string {
    const target = cmd.targetName;
    switch (cmd.intent) {
        case "disable_product":
            return `Desactivar el producto "${target}"`;
        case "enable_product":
            return `Activar el producto "${target}"`;
        case "price_increase_percent":
            return `Aumentar el precio de "${target}" un ${cmd.value}%`;
        case "price_decrease_percent":
            return `Reducir el precio de "${target}" un ${cmd.value}%`;
        case "price_increase_fixed":
            return `Aumentar el precio de "${target}" $${cmd.value}`;
        case "price_decrease_fixed":
            return `Reducir el precio de "${target}" $${cmd.value}`;
        case "price_set":
            return `Fijar el precio de "${target}" en $${cmd.value}`;
        case "apply_discount":
            return `Aplicar un descuento del ${cmd.value}% a "${target}"`;
        case "rename":
            return `Renombrar "${target}" a "${cmd.newName}"`;
        case "hide_menu":
            return `Ocultar "${target}" del menú`;
        case "show_menu":
            return `Mostrar "${target}" en el menú`;
        case "disable_category":
            return `Desactivar la categoría "${target}"`;
        case "enable_category":
            return `Activar la categoría "${target}"`;
        default:
            return `Ejecutar acción sobre "${target}"`;
    }
}
