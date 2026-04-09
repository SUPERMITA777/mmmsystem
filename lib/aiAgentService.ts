/**
 * aiAgentService.ts
 * 
 * Servicio central del Agente IA Autónomo.
 * Usa Gemini (Google Generative AI) con function calling para
 * procesar mensajes de WhatsApp y ejecutar acciones administrativas.
 */

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

export interface PersonalityMode {
    id: string;
    name: string;
    emoji: string;
    description: string;
    tone: string; // Instructions for the AI on how to communicate
}

export interface AgentConfig {
    enabled: boolean;
    whatsapp_enabled: boolean;
    system_prompt: string;
    training_snippets: TrainingSnippet[];
    allowed_operations: string[];
    auto_reply: boolean;
    business_hours_only: boolean;
    max_tokens: number;
    // New fields
    agent_name: string;
    personality_modes: PersonalityMode[];
    active_personality: string; // ID of active mode
    handoff_triggers: string[]; // phrases to hand off to human
    resume_triggers: string[]; // phrases to resume the agent
    handoff_timeout_seconds: number; // 0 = disabled
}

export interface TrainingSnippet {
    id: string;
    title: string;
    content: string;
}

export interface AgentResponse {
    reply: string;
    action?: {
        type: string;
        details: Record<string, any>;
        result: string;
    };
    handoff?: boolean; // true if the agent handed off to a human
}

const DEFAULT_PERSONALITIES: PersonalityMode[] = [
    {
        id: "friendly",
        name: "Amigable",
        emoji: "😊",
        description: "Cálido, cercano y con humor. Ideal para negocios informales.",
        tone: "Respondé de forma cálida, cercana y amigable. Usá humor suave y emojis para hacer la conversación amena. Tratá al cliente como si fuera un amigo. Si es posible, hacé comentarios simpáticos.",
    },
    {
        id: "professional",
        name: "Profesional",
        emoji: "💼",
        description: "Formal, eficiente y directo. Ideal para empresas serias.",
        tone: "Respondé de forma profesional, eficiente y cortés. Sé directo y claro. Usá un tono respetuoso sin ser frío. Minimizá el uso de emojis. Priorizá la información precisa.",
    },
    {
        id: "enthusiastic",
        name: "Entusiasta",
        emoji: "🚀",
        description: "Energético, positivo y motivador. Ideal para marcas jóvenes.",
        tone: "Respondé con mucha energía y entusiasmo. Usá emojis libremente, celebrá las decisiones del cliente, y mostrá pasión por los productos/servicios. Hacé que el cliente se sienta especial.",
    },
];

const DEFAULT_CONFIG: AgentConfig = {
    enabled: false,
    whatsapp_enabled: false,
    system_prompt: "",
    training_snippets: [],
    allowed_operations: ["view_products", "view_orders"],
    auto_reply: true,
    business_hours_only: false,
    max_tokens: 1000,
    agent_name: "Asistente",
    personality_modes: DEFAULT_PERSONALITIES,
    active_personality: "friendly",
    handoff_triggers: ["hablar con un humano", "hablar con una persona", "quiero hablar con", "operador", "agente humano"],
    resume_triggers: ["volver al bot", "hablar con el bot", "hablar con el agente", "volver al asistente"],
    handoff_timeout_seconds: 300, // 5 minutes
};

// ═══════════════════════════════════════════
// GEMINI TOOLS (Function Calling)
// ═══════════════════════════════════════════

const AGENT_TOOLS: any[] = [
    {
        functionDeclarations: [
            {
                name: "get_products",
                description: "Obtener la lista de productos del menú, opcionalmente filtrada por categoría o disponibilidad",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        category: {
                            type: SchemaType.STRING,
                            description: "Nombre de la categoría para filtrar (opcional)",
                        },
                        active_only: {
                            type: SchemaType.BOOLEAN,
                            description: "Si es true, solo muestra productos activos",
                        },
                    },
                },
            },
            {
                name: "get_product_price",
                description: "Obtener el precio de un producto específico por nombre",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        product_name: {
                            type: SchemaType.STRING,
                            description: "El nombre del producto a buscar",
                        },
                    },
                    required: ["product_name"],
                },
            },
            {
                name: "get_categories",
                description: "Obtener la lista de categorías del menú",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {},
                },
            },
            {
                name: "get_active_orders",
                description: "Obtener los pedidos activos/pendientes",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        status: {
                            type: SchemaType.STRING,
                            description: "Filtrar por estado: pendiente, en_proceso, listo, entregado",
                        },
                    },
                },
            },
            {
                name: "toggle_product_availability",
                description: "Activar o desactivar un producto",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        product_name: {
                            type: SchemaType.STRING,
                            description: "Nombre del producto",
                        },
                        active: {
                            type: SchemaType.BOOLEAN,
                            description: "true para activar, false para desactivar",
                        },
                    },
                    required: ["product_name", "active"],
                },
            },
            {
                name: "update_product_price",
                description: "Cambiar el precio de un producto",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        product_name: {
                            type: SchemaType.STRING,
                            description: "Nombre del producto",
                        },
                        new_price: {
                            type: SchemaType.NUMBER,
                            description: "Nuevo precio del producto",
                        },
                    },
                    required: ["product_name", "new_price"],
                },
            },
            {
                name: "create_order",
                description: "Crear un nuevo pedido para un cliente",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        customer_name: {
                            type: SchemaType.STRING,
                            description: "Nombre del cliente",
                        },
                        customer_phone: {
                            type: SchemaType.STRING,
                            description: "Teléfono del cliente",
                        },
                        items: {
                            type: SchemaType.STRING,
                            description: "Descripción de los items del pedido, separados por coma",
                        },
                        delivery_address: {
                            type: SchemaType.STRING,
                            description: "Dirección de entrega (opcional para retiro en local)",
                        },
                        notes: {
                            type: SchemaType.STRING,
                            description: "Notas o comentarios del pedido",
                        },
                    },
                    required: ["customer_name", "items"],
                },
            },
        ],
    },
];

// ═══════════════════════════════════════════
// CONFIG MANAGEMENT
// ═══════════════════════════════════════════

export async function getAgentConfig(sucursalId: string): Promise<AgentConfig> {
    const { data } = await supabaseAdmin
        .from("config_sucursal")
        .select("ai_agent_config")
        .eq("sucursal_id", sucursalId)
        .maybeSingle();

    if (data?.ai_agent_config) {
        return { ...DEFAULT_CONFIG, ...data.ai_agent_config };
    }
    return DEFAULT_CONFIG;
}

export async function updateAgentConfig(
    sucursalId: string,
    config: Partial<AgentConfig>
): Promise<boolean> {
    const current = await getAgentConfig(sucursalId);
    const updated = { ...current, ...config };

    const { error } = await supabaseAdmin
        .from("config_sucursal")
        .update({ ai_agent_config: updated })
        .eq("sucursal_id", sucursalId);

    if (error) {
        // If row doesn't exist, upsert
        const { error: upsertError } = await supabaseAdmin
            .from("config_sucursal")
            .upsert({
                sucursal_id: sucursalId,
                ai_agent_config: updated,
            }, { onConflict: "sucursal_id" });

        return !upsertError;
    }
    return true;
}

// ═══════════════════════════════════════════
// CONVERSATION HISTORY
// ═══════════════════════════════════════════

async function getOrCreateConversation(sucursalId: string, senderPhone: string) {
    // Try to find existing conversation (active or handed_off)
    const { data: existing } = await supabaseAdmin
        .from("whatsapp_conversations")
        .select("*")
        .eq("sucursal_id", sucursalId)
        .eq("sender_phone", senderPhone)
        .in("status", ["active", "handed_off"])
        .maybeSingle();

    if (existing) {
        await supabaseAdmin
            .from("whatsapp_conversations")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", existing.id);
        return existing;
    }

    // Create new conversation
    const { data: newConv } = await supabaseAdmin
        .from("whatsapp_conversations")
        .insert({
            sucursal_id: sucursalId,
            sender_phone: senderPhone,
            status: "active",
        })
        .select()
        .single();

    return newConv;
}

// ═══════════════════════════════════════════
// HANDOFF MANAGEMENT
// ═══════════════════════════════════════════

function matchesTrigger(text: string, triggers: string[]): boolean {
    const normalized = text.toLowerCase().trim();
    return triggers.some(trigger => normalized.includes(trigger.toLowerCase()));
}

async function handOffConversation(conversationId: string, handedTo: string) {
    await supabaseAdmin
        .from("whatsapp_conversations")
        .update({
            status: "handed_off",
            metadata: {
                handed_off_at: new Date().toISOString(),
                handed_off_to: handedTo,
            },
        })
        .eq("id", conversationId);
}

async function resumeConversation(conversationId: string) {
    await supabaseAdmin
        .from("whatsapp_conversations")
        .update({
            status: "active",
            metadata: {},
        })
        .eq("id", conversationId);
}

function isHandoffTimedOut(conversation: any, timeoutSeconds: number): boolean {
    if (timeoutSeconds <= 0) return false;
    if (conversation.status !== "handed_off") return false;
    const handedOffAt = conversation.metadata?.handed_off_at;
    if (!handedOffAt) return false;
    const elapsed = (Date.now() - new Date(handedOffAt).getTime()) / 1000;
    return elapsed >= timeoutSeconds;
}

async function saveMessage(
    conversationId: string,
    sucursalId: string,
    senderPhone: string,
    messageText: string,
    replyText: string | null,
    fromMe: boolean
) {
    await supabaseAdmin.from("whatsapp_messages").insert({
        conversation_id: conversationId,
        sucursal_id: sucursalId,
        sender_phone: senderPhone,
        message_text: messageText,
        reply_text: replyText,
        from_me: fromMe,
        processed: true,
    });
}

async function getRecentMessages(
    sucursalId: string,
    senderPhone: string,
    limit: number = 10
) {
    const { data } = await supabaseAdmin
        .from("whatsapp_messages")
        .select("message_text, reply_text, from_me, created_at")
        .eq("sucursal_id", sucursalId)
        .eq("sender_phone", senderPhone)
        .order("created_at", { ascending: false })
        .limit(limit);

    return (data || []).reverse();
}

// ═══════════════════════════════════════════
// TOOL EXECUTION
// ═══════════════════════════════════════════

async function executeTool(
    toolName: string,
    args: Record<string, any>,
    sucursalId: string,
    config: AgentConfig
): Promise<string> {
    try {
        switch (toolName) {
            case "get_products": {
                if (!config.allowed_operations.includes("view_products")) {
                    return JSON.stringify({ error: "Operación no permitida por el administrador." });
                }
                let query = supabaseAdmin
                    .from("productos")
                    .select("nombre, precio, activo, categorias(nombre)")
                    .eq("sucursal_id", sucursalId);
                if (args.active_only) query = query.eq("activo", true);
                if (args.category) {
                    const { data: cats } = await supabaseAdmin
                        .from("categorias")
                        .select("id")
                        .eq("sucursal_id", sucursalId)
                        .ilike("nombre", `%${args.category}%`);
                    if (cats && cats.length > 0) {
                        query = query.in("categoria_id", cats.map(c => c.id));
                    }
                }
                const { data } = await query.limit(50);
                return JSON.stringify(data || []);
            }

            case "get_product_price": {
                if (!config.allowed_operations.includes("view_products")) {
                    return JSON.stringify({ error: "Operación no permitida." });
                }
                const { data } = await supabaseAdmin
                    .from("productos")
                    .select("nombre, precio, activo")
                    .eq("sucursal_id", sucursalId)
                    .ilike("nombre", `%${args.product_name}%`)
                    .limit(5);
                return JSON.stringify(data || []);
            }

            case "get_categories": {
                if (!config.allowed_operations.includes("view_products")) {
                    return JSON.stringify({ error: "Operación no permitida." });
                }
                const { data } = await supabaseAdmin
                    .from("categorias")
                    .select("nombre, activo")
                    .eq("sucursal_id", sucursalId);
                return JSON.stringify(data || []);
            }

            case "get_active_orders": {
                if (!config.allowed_operations.includes("view_orders")) {
                    return JSON.stringify({ error: "Operación no permitida." });
                }
                let query = supabaseAdmin
                    .from("pedidos")
                    .select("numero_pedido, estado, tipo_entrega, total, cliente_nombre, created_at")
                    .eq("sucursal_id", sucursalId)
                    .order("created_at", { ascending: false })
                    .limit(20);
                if (args.status) {
                    query = query.eq("estado", args.status);
                } else {
                    query = query.in("estado", ["pendiente", "en_proceso", "listo"]);
                }
                const { data } = await query;
                return JSON.stringify(data || []);
            }

            case "toggle_product_availability": {
                if (!config.allowed_operations.includes("modify_products")) {
                    return JSON.stringify({ error: "No tenés permisos para modificar productos. Contactá al administrador." });
                }
                const { data: products } = await supabaseAdmin
                    .from("productos")
                    .select("id, nombre, activo")
                    .eq("sucursal_id", sucursalId)
                    .ilike("nombre", `%${args.product_name}%`);

                if (!products || products.length === 0) {
                    return JSON.stringify({ error: `No encontré ningún producto con el nombre "${args.product_name}".` });
                }

                const ids = products.map(p => p.id);
                await supabaseAdmin
                    .from("productos")
                    .update({ activo: args.active })
                    .in("id", ids);

                // Log action
                await logAgentAction(sucursalId, "toggle_product", {
                    products: products.map(p => p.nombre),
                    active: args.active,
                }, "whatsapp");

                return JSON.stringify({
                    success: true,
                    message: `${args.active ? "Activé" : "Desactivé"} ${products.length} producto(s): ${products.map(p => p.nombre).join(", ")}`,
                });
            }

            case "update_product_price": {
                if (!config.allowed_operations.includes("modify_products")) {
                    return JSON.stringify({ error: "No tenés permisos para modificar precios." });
                }
                const { data: products } = await supabaseAdmin
                    .from("productos")
                    .select("id, nombre, precio")
                    .eq("sucursal_id", sucursalId)
                    .ilike("nombre", `%${args.product_name}%`);

                if (!products || products.length === 0) {
                    return JSON.stringify({ error: `No encontré "${args.product_name}".` });
                }

                const oldPrices = products.map(p => ({ nombre: p.nombre, precio_anterior: p.precio }));
                await supabaseAdmin
                    .from("productos")
                    .update({ precio: args.new_price })
                    .in("id", products.map(p => p.id));

                await logAgentAction(sucursalId, "update_price", {
                    products: oldPrices,
                    new_price: args.new_price,
                }, "whatsapp");

                return JSON.stringify({
                    success: true,
                    message: `Actualicé el precio de ${products.map(p => p.nombre).join(", ")} a $${args.new_price}`,
                });
            }

            case "create_order": {
                if (!config.allowed_operations.includes("create_orders")) {
                    return JSON.stringify({ error: "No tenés permisos para crear pedidos. Contactá al administrador." });
                }
                // For now, create a basic pending order
                const { data: order, error } = await supabaseAdmin
                    .from("pedidos")
                    .insert({
                        sucursal_id: sucursalId,
                        cliente_nombre: args.customer_name,
                        cliente_telefono: args.customer_phone || "",
                        estado: "pendiente",
                        tipo_entrega: args.delivery_address ? "delivery" : "retiro",
                        direccion: args.delivery_address || "",
                        comentarios: `[IA WhatsApp] Items: ${args.items}${args.notes ? ` | Notas: ${args.notes}` : ""}`,
                        total: 0,
                    })
                    .select("numero_pedido, id")
                    .single();

                if (error) {
                    return JSON.stringify({ error: "Error al crear el pedido: " + error.message });
                }

                await logAgentAction(sucursalId, "create_order", {
                    order_id: order?.id,
                    customer: args.customer_name,
                    items: args.items,
                }, "whatsapp");

                return JSON.stringify({
                    success: true,
                    message: `Pedido creado exitosamente (#${order?.numero_pedido || "nuevo"}) para ${args.customer_name}`,
                });
            }

            default:
                return JSON.stringify({ error: "Función no reconocida." });
        }
    } catch (err: any) {
        console.error(`[Agent Tool Error] ${toolName}:`, err.message);
        return JSON.stringify({ error: "Error interno procesando la solicitud." });
    }
}

// ═══════════════════════════════════════════
// ACTION LOG
// ═══════════════════════════════════════════

async function logAgentAction(
    sucursalId: string,
    actionType: string,
    details: Record<string, any>,
    source: string,
    senderPhone?: string
) {
    await supabaseAdmin.from("ai_agent_actions").insert({
        sucursal_id: sucursalId,
        action_type: actionType,
        action_details: details,
        source,
        sender_phone: senderPhone,
        status: "executed",
    });
}

// ═══════════════════════════════════════════
// SYSTEM PROMPT BUILDER
// ═══════════════════════════════════════════

function buildSystemPrompt(config: AgentConfig, sucursalName: string): string {
    const operationDescriptions: Record<string, string> = {
        view_products: "consultar productos, precios y categorías del menú",
        view_orders: "ver pedidos activos y su estado",
        modify_products: "activar/desactivar productos y cambiar precios",
        create_orders: "crear nuevos pedidos para clientes",
        manage_discounts: "gestionar descuentos y promociones",
    };

    const allowedOps = config.allowed_operations
        .map(op => operationDescriptions[op] || op)
        .join(", ");

    // Get active personality
    const personality = config.personality_modes.find(p => p.id === config.active_personality)
        || config.personality_modes[0];

    const agentName = config.agent_name || "Asistente";

    let prompt = `Tu nombre es "${agentName}", sos el asistente virtual de "${sucursalName}". 
Cuando un cliente te pregunte cómo te llamás o quién sos, presentate como ${agentName}.
Tu rol es atender a los clientes por WhatsApp.

PERSONALIDAD Y TONO:
${personality.tone}

REGLAS FUNDAMENTALES:
1. Respondé siempre en español argentino (usá "vos" en vez de "tú").
2. Sé conciso: las respuestas de WhatsApp deben ser cortas y directas.
3. Si no sabés algo, decilo honestamente y ofrecé contactar al encargado.
4. NUNCA inventes información sobre productos, precios o disponibilidad. Usá las herramientas disponibles.
5. Si un cliente pide algo que no podés hacer, explicale amablemente por qué.
6. Si el cliente pide hablar con un humano, despedite amablemente e indicá que lo vas a derivar.

OPERACIONES PERMITIDAS: ${allowedOps}.

`;

    if (config.system_prompt) {
        prompt += `\nINSTRUCCIONES ESPECIALES DEL NEGOCIO:\n${config.system_prompt}\n\n`;
    }

    if (config.training_snippets.length > 0) {
        prompt += `\nINFORMACIÓN IMPORTANTE DEL NEGOCIO:\n`;
        for (const snippet of config.training_snippets) {
            prompt += `\n--- ${snippet.title} ---\n${snippet.content}\n`;
        }
    }

    return prompt;
}

// ═══════════════════════════════════════════
// MAIN: PROCESS WHATSAPP MESSAGE
// ═══════════════════════════════════════════

export async function processWhatsAppMessage(
    sucursalId: string,
    senderPhone: string,
    text: string,
    fromMe: boolean = false
): Promise<AgentResponse> {
    // 1. Load agent config
    const config = await getAgentConfig(sucursalId);

    if (!config.enabled || !config.whatsapp_enabled) {
        return { reply: "" }; // Agent disabled, no reply
    }

    // Skip messages sent by ourselves
    if (fromMe) {
        return { reply: "" };
    }

    // 2. Get/create conversation and save incoming message
    const conversation = await getOrCreateConversation(sucursalId, senderPhone);
    if (!conversation) {
        return { reply: "⚠️ Error interno. Por favor intentá de nuevo." };
    }

    const agentName = config.agent_name || "Asistente";

    // 3. HANDOFF LOGIC
    // Check if user wants to resume the agent
    if (conversation.status === "handed_off") {
        if (matchesTrigger(text, config.resume_triggers)) {
            await resumeConversation(conversation.id);
            await saveMessage(conversation.id, sucursalId, senderPhone, text, null, false);
            return {
                reply: `¡Hola de nuevo! 👋 Soy ${agentName}, tu asistente virtual. ¿En qué puedo ayudarte?`,
            };
        }
        // Check if timeout has elapsed
        if (isHandoffTimedOut(conversation, config.handoff_timeout_seconds)) {
            await resumeConversation(conversation.id);
            // Fall through to normal processing
        } else {
            // Still handed off, don't respond
            await saveMessage(conversation.id, sucursalId, senderPhone, text, null, false);
            return { reply: "" };
        }
    }

    // Check if user wants to talk to a human
    if (matchesTrigger(text, config.handoff_triggers)) {
        // Extract the name they want to talk to (if any)
        const handedTo = text.replace(/quiero\s+hablar\s+con\s*/i, "").trim() || "operador";
        await handOffConversation(conversation.id, handedTo);
        await saveMessage(conversation.id, sucursalId, senderPhone, text, null, false);

        const timeoutMsg = config.handoff_timeout_seconds > 0
            ? ` Si no te responden en ${Math.round(config.handoff_timeout_seconds / 60)} minutos, vuelvo a estar disponible automáticamente.`
            : "";

        return {
            reply: `Entendido, te voy a derivar con ${handedTo}. 🙌${timeoutMsg}\n\nSi querés volver a hablar conmigo, escribí "hablar con el bot".`,
            handoff: true,
        };
    }

    // 3. Get recent conversation history for context
    const recentMessages = await getRecentMessages(sucursalId, senderPhone, 8);

    // 4. Get sucursal name
    const { data: sucursal } = await supabaseAdmin
        .from("sucursales")
        .select("nombre")
        .eq("id", sucursalId)
        .single();

    const sucursalName = sucursal?.nombre || "Nuestro Negocio";

    // 5. Build Gemini prompt with context
    const systemPrompt = buildSystemPrompt(config, sucursalName);

    // 6. Filter tools based on allowed operations
    const allowedTools = filterToolsByPermissions(config.allowed_operations);

    // 7. Call Gemini
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            systemInstruction: systemPrompt,
            tools: allowedTools.length > 0 ? allowedTools : undefined,
        });

        // Build chat history from recent messages
        const chatHistory = recentMessages.map(msg => ({
            role: msg.from_me ? "model" as const : "user" as const,
            parts: [{ text: msg.from_me ? (msg.reply_text || "") : msg.message_text }],
        })).filter(m => m.parts[0].text);

        const chat = model.startChat({ history: chatHistory });

        let response = await chat.sendMessage(text);
        let result = response.response;
        let actionPerformed: AgentResponse["action"] | undefined;

        // Handle function calls (tool use)
        let maxIterations = 5;
        while (result.candidates?.[0]?.content?.parts?.some(p => p.functionCall) && maxIterations > 0) {
            maxIterations--;
            const functionCalls = result.candidates[0].content.parts.filter(p => p.functionCall);

            const functionResponses = [];
            for (const part of functionCalls) {
                const fc = part.functionCall!;
                const toolResult = await executeTool(fc.name, fc.args as Record<string, any>, sucursalId, config);

                functionResponses.push({
                    functionResponse: {
                        name: fc.name,
                        response: JSON.parse(toolResult),
                    },
                });

                // Track the action
                if (!actionPerformed && fc.name !== "get_products" && fc.name !== "get_product_price" && fc.name !== "get_categories" && fc.name !== "get_active_orders") {
                    actionPerformed = {
                        type: fc.name,
                        details: fc.args as Record<string, any>,
                        result: toolResult,
                    };
                }
            }

            response = await chat.sendMessage(functionResponses);
            result = response.response;
        }

        const replyText = result.text() || "No pude procesar tu mensaje. ¿Podrías reformularlo?";

        // 8. Save messages
        await saveMessage(conversation.id, sucursalId, senderPhone, text, replyText, false);

        return {
            reply: replyText,
            action: actionPerformed,
        };
    } catch (err: any) {
        console.error("[Agent Gemini Error]:", err.message);
        await saveMessage(conversation.id, sucursalId, senderPhone, text, null, false);
        return {
            reply: "😅 Perdón, tuve un problema técnico. ¿Podrías intentar de nuevo en unos segundos?",
        };
    }
}

// ═══════════════════════════════════════════
// TOOL FILTERING
// ═══════════════════════════════════════════

function filterToolsByPermissions(allowedOps: string[]) {
    const readTools = ["get_products", "get_product_price", "get_categories"];
    const orderReadTools = ["get_active_orders"];
    const writeTools = ["toggle_product_availability", "update_product_price"];
    const orderWriteTools = ["create_order"];

    const allowed: string[] = [];
    if (allowedOps.includes("view_products")) allowed.push(...readTools);
    if (allowedOps.includes("view_orders")) allowed.push(...orderReadTools);
    if (allowedOps.includes("modify_products")) allowed.push(...writeTools);
    if (allowedOps.includes("create_orders")) allowed.push(...orderWriteTools);

    if (allowed.length === 0) return [];

    return [
        {
            functionDeclarations: AGENT_TOOLS[0].functionDeclarations.filter((fd: any) =>
                allowed.includes(fd.name)
            ),
        },
    ];
}
