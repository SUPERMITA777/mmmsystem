/**
 * commandParser.ts
 * 
 * Motor NLP local para interpretar comandos en español sobre productos y categorías.
 * Reconoce patrones como:
 *   - "deshabilita empanadas de carne"
 *   - "aumenta las pizzas con morrón un 10%"
 *   - "cambia el nombre de pizza grande a pizza XL"
 *   - "ponele $5000 a la pizza grande"
 *   - "oculta milanesa del menú"
 *   - "deshabilita la categoría empanadas"
 */

export type CommandIntent =
    | "disable_product"
    | "enable_product"
    | "price_increase_percent"
    | "price_decrease_percent"
    | "price_increase_fixed"
    | "price_decrease_fixed"
    | "price_set"
    | "rename"
    | "hide_menu"
    | "show_menu"
    | "disable_category"
    | "enable_category";

export interface ParsedCommand {
    intent: CommandIntent;
    targetName: string;
    value?: number;        // percentage or fixed price
    newName?: string;       // for rename
    targetType: "producto" | "categoria";
}

export interface ParseResult {
    success: boolean;
    command?: ParsedCommand;
    error?: string;
}

// Normalize text: lowercase, remove accents, trim
function normalize(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

// Remove common filler words for cleaner entity extraction
function cleanEntityName(name: string): string {
    return name
        .replace(/^(el|la|los|las|un|una|unos|unas|al|del|de la|de los|de las)\s+/gi, "")
        .replace(/\s+(del|de la|de los|de las|en el|en la|del menu|del menú)\s*$/gi, "")
        .trim();
}

// ─── Pattern definitions ───────────────────────────────────────────
interface PatternDef {
    regex: RegExp;
    intent: CommandIntent;
    targetType: "producto" | "categoria";
    extractTarget: (match: RegExpMatchArray) => string;
    extractValue?: (match: RegExpMatchArray) => number | undefined;
    extractNewName?: (match: RegExpMatchArray) => string | undefined;
}

const patterns: PatternDef[] = [
    // ── PRICE INCREASE PERCENT ──
    {
        regex: /(?:aumenta|subi|subí|subile|incrementa|incrementá|aumentá)\s+(?:el\s+precio\s+(?:de\s+)?)?(?:las?\s+|los?\s+|la\s+|el\s+)?(.+?)\s+(?:un\s+)?(\d+(?:[.,]\d+)?)\s*%/i,
        intent: "price_increase_percent",
        targetType: "producto",
        extractTarget: (m) => m[1],
        extractValue: (m) => parseFloat(m[2].replace(",", ".")),
    },

    // ── PRICE DECREASE PERCENT ──
    {
        regex: /(?:baja|bajá|bajale|reduce|reducí|rebaja|rebajá|disminui|disminuí)\s+(?:el\s+precio\s+(?:de\s+)?)?(?:las?\s+|los?\s+|la\s+|el\s+)?(.+?)\s+(?:un\s+)?(\d+(?:[.,]\d+)?)\s*%/i,
        intent: "price_decrease_percent",
        targetType: "producto",
        extractTarget: (m) => m[1],
        extractValue: (m) => parseFloat(m[2].replace(",", ".")),
    },

    // ── PRICE INCREASE FIXED ($) ──
    {
        regex: /(?:aumenta|subi|subí|subile|incrementa|incrementá|aumentá)\s+(?:el\s+precio\s+(?:de\s+)?)?(?:las?\s+|los?\s+|la\s+|el\s+)?(.+?)\s+(?:un\s+)?\$\s*(\d+(?:[.,]\d+)?)/i,
        intent: "price_increase_fixed",
        targetType: "producto",
        extractTarget: (m) => m[1],
        extractValue: (m) => parseFloat(m[2].replace(",", ".")),
    },

    // ── PRICE DECREASE FIXED ($) ──
    {
        regex: /(?:baja|bajá|bajale|reduce|reducí|rebaja|rebajá|disminui|disminuí)\s+(?:el\s+precio\s+(?:de\s+)?)?(?:las?\s+|los?\s+|la\s+|el\s+)?(.+?)\s+(?:un\s+)?\$\s*(\d+(?:[.,]\d+)?)/i,
        intent: "price_decrease_fixed",
        targetType: "producto",
        extractTarget: (m) => m[1],
        extractValue: (m) => parseFloat(m[2].replace(",", ".")),
    },

    // ── PRICE SET (FIXED) ──
    {
        regex: /(?:ponele|poné|pon|setea|seteá|fija|fijá|cambia|cambiá)\s+(?:el\s+precio\s+(?:de\s+)?)?(?:a\s+)?\$?\s*(\d+(?:[.,]\d+)?)\s+(?:a\s+(?:la\s+|el\s+)?)?(.+)/i,
        intent: "price_set",
        targetType: "producto",
        extractTarget: (m) => m[2],
        extractValue: (m) => parseFloat(m[1].replace(",", ".")),
    },
    {
        regex: /(?:ponele|poné|pon|setea|seteá|fija|fijá|cambia|cambiá)\s+(?:el\s+)?precio\s+(?:de\s+(?:la\s+|el\s+)?)?(.+?)\s+(?:a|en)\s+\$?\s*(\d+(?:[.,]\d+)?)/i,
        intent: "price_set",
        targetType: "producto",
        extractTarget: (m) => m[1],
        extractValue: (m) => parseFloat(m[2].replace(",", ".")),
    },

    // ── RENAME ──
    {
        regex: /(?:cambia|cambiale|cambiá|cambiale|renombra|renombrá)\s+(?:el\s+)?nombre\s+(?:de\s+(?:la\s+|el\s+)?)?(.+?)\s+(?:a|por)\s+(.+)/i,
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
        regex: /(?:oculta|ocultá|esconde|escondé|sacá|saca)\s+(?:del?\s+menú?\s+)?(?:las?\s+|los?\s+|la\s+|el\s+)?(.+?)(?:\s+del?\s+menú?)?$/i,
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

    // ── PRICE SET CATCH-ALL (MUST BE LAST AND MORE RESTRICTIVE) ──
    {
        // Requires a dollar sign to be present and not start with other known verbs
        regex: /^(?!(?:aumenta|subi|baja|oculta|mostra|cambia|deshabilita|habilita|renombra|ponele|setea|fija|pon|agreg)).+?\s+(?:a\s+)?\$\s*(\d+(?:[.,]\d+)?)\s*$/i,
        intent: "price_set",
        targetType: "producto",
        extractTarget: (m) => m[0].split(/\s+(?:a\s+)?\$/)[0],
        extractValue: (m) => parseFloat(m[1].replace(",", ".")),
    },
];

export function parseCommand(input: string): ParseResult {
    const trimmed = input.trim();
    if (!trimmed) {
        return { success: false, error: "El comando está vacío." };
    }

    for (const pattern of patterns) {
        const match = trimmed.match(pattern.regex);
        if (match) {
            const rawTarget = pattern.extractTarget(match);
            const targetName = cleanEntityName(rawTarget);

            if (!targetName) {
                continue; // skip if we couldn't extract a meaningful name
            }

            const command: ParsedCommand = {
                intent: pattern.intent,
                targetName,
                targetType: pattern.targetType,
            };

            if (pattern.extractValue) {
                command.value = pattern.extractValue(match);
            }
            if (pattern.extractNewName) {
                const raw = pattern.extractNewName(match);
                command.newName = raw ? cleanEntityName(raw) : undefined;
            }

            return { success: true, command };
        }
    }

    return {
        success: false,
        error: "No pude entender el comando. Probá con frases como:\n• \"deshabilita empanadas de carne\"\n• \"aumenta las pizzas un 10%\"\n• \"cambia el nombre de pizza grande a pizza XL\"\n• \"ponele $5000 a la pizza grande\"",
    };
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
