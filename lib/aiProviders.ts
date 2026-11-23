/**
 * aiProviders.ts
 *
 * Clientes REST oficiales sin dependencias externas para Gemini y OpenAI,
 * estimación de costos 2026 y tracking mensual de tokens en Supabase.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type AIProviderId = "gemini" | "openai" | "groq";
export type TokenUsageSource = "whatsapp" | "simulator" | "training" | "copilot";

export interface TokenUsageRecord {
    provider: AIProviderId;
    model: string;
    promptTokens: number;
    cachedTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
}

export interface MonthlyTokenUsageSummary {
    totalTokens: number;
    promptTokens: number;
    cachedTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
    requestsCount: number;
    tableReady: boolean;
}

export interface AvailableProviders {
    gemini: boolean;
    openai: boolean;
    groq: boolean;
}

interface ModelRatesPerMillion {
    input: number;
    cached: number;
    output: number;
}

const MODEL_RATES: Record<string, ModelRatesPerMillion> = {
    "gemini-2.5-flash": { input: 0.30, cached: 0.03, output: 2.50 },
    "gemini-2.5-flash-lite": { input: 0.10, cached: 0.01, output: 0.40 },
    "gemini-2.5-pro": { input: 1.25, cached: 0.31, output: 10.00 },
    "gpt-4.1-mini": { input: 0.40, cached: 0.10, output: 1.60 },
    "gpt-4.1-nano": { input: 0.10, cached: 0.025, output: 0.40 },
    "gpt-5-mini": { input: 0.25, cached: 0.025, output: 2.00 },
    "gpt-5-nano": { input: 0.05, cached: 0.005, output: 0.40 },
    "gpt-4o-mini": { input: 0.15, cached: 0.075, output: 0.60 },
    "llama-3.3-70b-versatile": { input: 0.59, cached: 0.59, output: 0.79 },
    "llama-3.1-8b-instant": { input: 0.05, cached: 0.05, output: 0.08 },
};

/**
 * Estima el costo en USD para una llamada según tarifas por millón de tokens.
 */
export function estimateCostUsd(
    model: string,
    promptTokens: number,
    cachedTokens: number,
    outputTokens: number
): number {
    const rates = MODEL_RATES[model] ?? { input: 0.59, cached: 0.59, output: 0.79 };
    const safeCached = Math.max(0, Math.min(cachedTokens, promptTokens));
    const uncachedInput = Math.max(0, promptTokens - safeCached);
    const cost =
        (uncachedInput * rates.input +
            safeCached * rates.cached +
            Math.max(0, outputTokens) * rates.output) /
        1_000_000;
    return Number(cost.toFixed(6));
}

/**
 * Indica qué proveedores tienen API key configurada en el servidor.
 */
export function getAvailableProviders(): AvailableProviders {
    return {
        gemini: Boolean(process.env.GEMINI_API_KEY?.trim()),
        openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
        groq: Boolean(process.env.GROQ_API_KEY?.trim()),
    };
}

/**
 * Registra el uso de tokens en `ai_token_usage` de forma resiliente.
 * Si la tabla aún no fue migrada en Supabase, falla silenciosamente.
 */
export async function logTokenUsage(
    sucursalId: string,
    source: TokenUsageSource,
    usage: TokenUsageRecord
): Promise<void> {
    try {
        if (!sucursalId || usage.totalTokens <= 0) return;
        await supabaseAdmin.from("ai_token_usage").insert({
            sucursal_id: sucursalId,
            provider: usage.provider,
            model: usage.model,
            source,
            prompt_tokens: usage.promptTokens,
            cached_tokens: usage.cachedTokens,
            output_tokens: usage.outputTokens,
            total_tokens: usage.totalTokens,
            estimated_cost_usd: usage.estimatedCostUsd,
        });
    } catch {
        // Silencioso si la migración aún no se ejecutó
    }
}

/**
 * Obtiene el resumen de consumo de tokens del mes calendario actual en Argentina.
 */
export async function getMonthlyTokenUsage(sucursalId: string): Promise<MonthlyTokenUsageSummary> {
    const empty: MonthlyTokenUsageSummary = {
        totalTokens: 0,
        promptTokens: 0,
        cachedTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        requestsCount: 0,
        tableReady: false,
    };

    try {
        const now = new Date();
        const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
        const { data, error } = await supabaseAdmin
            .from("ai_token_usage")
            .select("prompt_tokens, cached_tokens, output_tokens, total_tokens, estimated_cost_usd")
            .eq("sucursal_id", sucursalId)
            .gte("created_at", startOfMonth.toISOString());

        if (error || !data) {
            return empty;
        }

        let totalTokens = 0;
        let promptTokens = 0;
        let cachedTokens = 0;
        let outputTokens = 0;
        let estimatedCostUsd = 0;

        for (const row of data) {
            promptTokens += Number(row.prompt_tokens || 0);
            cachedTokens += Number(row.cached_tokens || 0);
            outputTokens += Number(row.output_tokens || 0);
            totalTokens += Number(row.total_tokens || 0);
            estimatedCostUsd += Number(row.estimated_cost_usd || 0);
        }

        return {
            totalTokens,
            promptTokens,
            cachedTokens,
            outputTokens,
            estimatedCostUsd: Number(estimatedCostUsd.toFixed(4)),
            requestsCount: data.length,
            tableReady: true,
        };
    } catch {
        return empty;
    }
}

// ═══════════════════════════════════════════
// GEMINI REST CLIENT (v1beta)
// ═══════════════════════════════════════════

export interface GeminiPart {
    text?: string;
    inlineData?: { mimeType: string; data: string };
    functionCall?: { name: string; args?: Record<string, any> };
    functionResponse?: { name: string; response: Record<string, any> };
    thoughtSignature?: string;
}

export interface GeminiContent {
    role: "user" | "model";
    parts: GeminiPart[];
}

export interface GeminiCallParams {
    model: string;
    systemInstruction?: string;
    contents: GeminiContent[];
    tools?: any[];
    maxOutputTokens?: number;
    temperature?: number;
    responseMimeType?: string;
    thinkingBudget?: number;
    apiKey?: string;
}

export interface GeminiCallResult {
    raw: any;
    parts: GeminiPart[];
    text: string;
    functionCalls: Array<{ name: string; args: Record<string, any> }>;
    usage: TokenUsageRecord;
}

/**
 * Llama a la API REST oficial de Gemini (`v1beta/models/...:generateContent`).
 */
export async function callGeminiGenerateContent(params: GeminiCallParams): Promise<GeminiCallResult> {
    const apiKey = (params.apiKey ?? process.env.GEMINI_API_KEY ?? "").trim();
    if (!apiKey) {
        const err: any = new Error("GEMINI_API_KEY no configurada");
        err.status = 401;
        throw err;
    }

    const generationConfig: Record<string, any> = {
        maxOutputTokens: params.maxOutputTokens ?? 1000,
    };

    if (typeof params.temperature === "number") {
        generationConfig.temperature = params.temperature;
    }
    if (params.responseMimeType) {
        generationConfig.responseMimeType = params.responseMimeType;
    }
    if (params.model.startsWith("gemini-2.5")) {
        generationConfig.thinkingConfig = {
            thinkingBudget: params.thinkingBudget ?? 0,
        };
    }

    const body: Record<string, any> = {
        contents: params.contents,
        generationConfig,
    };

    if (params.systemInstruction) {
        body.systemInstruction = {
            parts: [{ text: params.systemInstruction }],
        };
    }
    if (params.tools && params.tools.length > 0) {
        body.tools = params.tools;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(params.model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    const json: any = await response.json().catch(() => ({}));
    if (!response.ok) {
        const msg = json?.error?.message || `Gemini HTTP ${response.status}`;
        const err: any = new Error(msg);
        err.status = response.status;
        err.body = json;
        throw err;
    }

    const candidate = json?.candidates?.[0];
    const parts: GeminiPart[] = candidate?.content?.parts || [];
    const text = parts
        .filter((p) => typeof p.text === "string" && p.text.length > 0)
        .map((p) => p.text as string)
        .join("");

    const functionCalls = parts
        .filter((p) => p.functionCall && p.functionCall.name)
        .map((p) => ({
            name: p.functionCall!.name,
            args: (p.functionCall!.args || {}) as Record<string, any>,
        }));

    const um = json?.usageMetadata || {};
    const promptTokens = Number(um.promptTokenCount || 0);
    const cachedTokens = Number(um.cachedContentTokenCount || 0);
    const outputTokens = Number(um.candidatesTokenCount || 0) + Number(um.thoughtsTokenCount || 0);
    const totalTokens = Number(um.totalTokenCount || promptTokens + outputTokens);

    const usage: TokenUsageRecord = {
        provider: "gemini",
        model: params.model,
        promptTokens,
        cachedTokens,
        outputTokens,
        totalTokens,
        estimatedCostUsd: estimateCostUsd(params.model, promptTokens, cachedTokens, outputTokens),
    };

    return { raw: json, parts, text, functionCalls, usage };
}

// ═══════════════════════════════════════════
// OPENAI REST CLIENT (v1/chat/completions)
// ═══════════════════════════════════════════

export interface OpenAICallParams {
    model: string;
    messages: any[];
    tools?: any[];
    maxTokens?: number;
    temperature?: number;
    responseFormat?: { type: "json_object" | "text" };
    apiKey?: string;
}

export interface OpenAICallResult {
    raw: any;
    message: any;
    usage: TokenUsageRecord;
}

/**
 * Llama a la API REST oficial de OpenAI (`/v1/chat/completions`).
 */
export async function callOpenAIChatCompletion(params: OpenAICallParams): Promise<OpenAICallResult> {
    const apiKey = (params.apiKey ?? process.env.OPENAI_API_KEY ?? "").trim();
    if (!apiKey) {
        const err: any = new Error("OPENAI_API_KEY no configurada");
        err.status = 401;
        throw err;
    }

    const isGpt5 = params.model.startsWith("gpt-5");
    const body: Record<string, any> = {
        model: params.model,
        messages: params.messages,
    };

    if (isGpt5) {
        body.max_completion_tokens = params.maxTokens ?? 1000;
        body.reasoning_effort = "low";
    } else {
        body.max_tokens = params.maxTokens ?? 1000;
        if (typeof params.temperature === "number") {
            body.temperature = params.temperature;
        }
    }

    if (params.tools && params.tools.length > 0) {
        body.tools = params.tools;
        body.tool_choice = "auto";
    }
    if (params.responseFormat) {
        body.response_format = params.responseFormat;
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });

    const json: any = await response.json().catch(() => ({}));
    if (!response.ok) {
        const msg = json?.error?.message || `OpenAI HTTP ${response.status}`;
        const err: any = new Error(msg);
        err.status = response.status;
        err.body = json;
        throw err;
    }

    const message = json?.choices?.[0]?.message || {};
    const u = json?.usage || {};
    const promptTokens = Number(u.prompt_tokens || 0);
    const cachedTokens = Number(u.prompt_tokens_details?.cached_tokens || 0);
    const outputTokens = Number(u.completion_tokens || 0);
    const totalTokens = Number(u.total_tokens || promptTokens + outputTokens);

    const usage: TokenUsageRecord = {
        provider: "openai",
        model: params.model,
        promptTokens,
        cachedTokens,
        outputTokens,
        totalTokens,
        estimatedCostUsd: estimateCostUsd(params.model, promptTokens, cachedTokens, outputTokens),
    };

    return { raw: json, message, usage };
}
