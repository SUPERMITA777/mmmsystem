/**
 * commandParser.ts
 * 
 * Motor NLP avanzado utilizando Google Gemini para interpretar comandos en español.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export type CommandIntent =
    | "disable_product"
    | "enable_product"
    | "price_increase_percent"
    | "price_decrease_percent"
    | "price_increase_fixed"
    | "price_decrease_fixed"
    | "price_set"
    | "apply_discount" // Nuevo
    | "rename"
    | "hide_menu"
    | "show_menu"
    | "disable_category"
    | "enable_category";

export interface ParsedCommand {
    intent: CommandIntent;
    targetName: string;
    value?: number;        // percentage, amount or discount percent
    newName?: string;       // for rename
    targetType: "producto" | "categoria";
}

export interface ParseResult {
    success: boolean;
    command?: ParsedCommand;
    error?: string;
}

// Inicializar Gemini
// Se requiere GEMINI_API_KEY en .env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: { responseMimeType: "application/json" }
});

const SYSTEM_PROMPT = `
Eres un asistente experto en gestión de inventario y menús de restaurantes.
Tu tarea es convertir comandos en español a un formato JSON estructurado.

Los posibles intents son:
- "disable_product": Desactivar un producto.
- "enable_product": Activar un producto.
- "price_increase_percent": Aumentar precio por porcentaje.
- "price_decrease_percent": Disminuir precio por porcentaje.
- "price_increase_fixed": Aumentar precio un monto fijo ($).
- "price_decrease_fixed": Disminuir precio un monto fijo ($).
- "price_set": Establecer precio a un valor exacto.
- "apply_discount": Aplicar un descuento (bajar el precio un X%).
- "rename": Cambiar el nombre.
- "hide_menu": Ocultar del menú público.
- "show_menu": Mostrar en el menú público.
- "disable_category": Desactivar una categoría entera.
- "enable_category": Activar una categoría entera.

Formato de salida JSON:
{
  "intent": string (uno de los arriba mencionados),
  "targetName": string (nombre del producto o categoría sin artículos),
  "targetType": "producto" | "categoria",
  "value": number (opcional, para precios, porcentajes o descuentos),
  "newName": string (opcional, para rename)
}

Ejemplos:
"baja el precio de las empanadas un 10%" -> {"intent": "price_decrease_percent", "targetName": "empanadas", "targetType": "producto", "value": 10}
"deshabilita la categoría pizzas" -> {"intent": "disable_category", "targetName": "pizzas", "targetType": "categoria"}
"ponele un descuento del 15% a las burgers" -> {"intent": "apply_discount", "targetName": "burgers", "targetType": "producto", "value": 15}
"la pizza grande cuesta $5000" -> {"intent": "price_set", "targetName": "pizza grande", "targetType": "producto", "value": 5000}
"cambia el nombre de coca a coca cola zero" -> {"intent": "rename", "targetName": "coca", "targetType": "producto", "newName": "coca cola zero"}

Responde SOLO el JSON.
`;

export async function parseCommand(input: string): Promise<ParseResult> {
    const trimmed = input.trim();
    if (!trimmed) {
        return { success: false, error: "El comando está vacío." };
    }

    if (!process.env.GEMINI_API_KEY) {
        return { success: false, error: "Configuración de IA incompleta (Falta GEMINI_API_KEY)." };
    }

    try {
        const result = await model.generateContent([SYSTEM_PROMPT, input]);
        const response = await result.response;
        const text = response.text();

        const parsed = JSON.parse(text);

        return {
            success: true,
            command: parsed as ParsedCommand
        };
    } catch (error: any) {
        console.error("Error en Gemini Parser:", error);
        return {
            success: false,
            error: "No pude procesar el comando con la IA. Error: " + error.message
        };
    }
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
