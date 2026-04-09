/**
 * agent-config/route.ts
 * 
 * CRUD endpoint for AI agent configuration.
 * GET: Retrieve agent config + conversations + action history
 * PUT: Update agent config (system prompt, training snippets, permissions, etc.)
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAgentConfig, updateAgentConfig } from "@/lib/aiAgentService";

// GET: Retrieve agent config + data for the admin panel
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const sucursalId = searchParams.get("sucursal_id");
        const section = searchParams.get("section") || "config"; // config | conversations | actions

        if (!sucursalId) {
            return NextResponse.json({ error: "sucursal_id requerido" }, { status: 400 });
        }

        switch (section) {
            case "config": {
                const config = await getAgentConfig(sucursalId);
                return NextResponse.json({ success: true, config });
            }

            case "conversations": {
                const { data } = await supabaseAdmin
                    .from("whatsapp_conversations")
                    .select(`
                        id,
                        sender_phone,
                        sender_name,
                        last_message_at,
                        status,
                        metadata,
                        created_at
                    `)
                    .eq("sucursal_id", sucursalId)
                    .order("last_message_at", { ascending: false })
                    .limit(50);

                return NextResponse.json({ success: true, conversations: data || [] });
            }

            case "messages": {
                const conversationId = searchParams.get("conversation_id");
                if (!conversationId) {
                    return NextResponse.json({ error: "conversation_id requerido" }, { status: 400 });
                }

                const { data } = await supabaseAdmin
                    .from("whatsapp_messages")
                    .select("*")
                    .eq("conversation_id", conversationId)
                    .order("created_at", { ascending: true })
                    .limit(100);

                return NextResponse.json({ success: true, messages: data || [] });
            }

            case "actions": {
                const { data } = await supabaseAdmin
                    .from("ai_agent_actions")
                    .select("*")
                    .eq("sucursal_id", sucursalId)
                    .order("created_at", { ascending: false })
                    .limit(50);

                return NextResponse.json({ success: true, actions: data || [] });
            }

            default:
                return NextResponse.json({ error: "Sección no válida" }, { status: 400 });
        }
    } catch (error: any) {
        console.error("[agent-config GET]:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT: Update agent config
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { sucursal_id, section, config, conversation_id } = body;

        if (!sucursal_id) {
            return NextResponse.json(
                { error: "sucursal_id es requerido" },
                { status: 400 }
            );
        }

        // Handle special sections
        if (section === "resume_conversation") {
            if (!conversation_id) {
                return NextResponse.json({ error: "conversation_id requerido" }, { status: 400 });
            }
            await supabaseAdmin
                .from("whatsapp_conversations")
                .update({ status: "active", metadata: {} })
                .eq("id", conversation_id)
                .eq("sucursal_id", sucursal_id);

            return NextResponse.json({ success: true, message: "Conversación retomada por el agente" });
        }

        // Default: update agent config
        if (!config) {
            return NextResponse.json(
                { error: "config es requerido" },
                { status: 400 }
            );
        }

        const success = await updateAgentConfig(sucursal_id, config);

        if (success) {
            return NextResponse.json({ success: true, message: "Configuración actualizada" });
        } else {
            return NextResponse.json({ error: "Error al guardar configuración" }, { status: 500 });
        }
    } catch (error: any) {
        console.error("[agent-config PUT]:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
