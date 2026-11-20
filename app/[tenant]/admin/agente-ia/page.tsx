"use client";

import { useEffect, useState, useCallback } from "react";
import { useTenant } from "@/context/TenantContext";
import {
    Bot, MessageSquare, Sparkles, Shield, BookOpen,
    Plus, Trash2, Save, Loader2, ToggleLeft, ToggleRight,
    ChevronDown, ChevronRight, Phone, Clock, Zap,
    Eye, Pencil, X, AlertCircle, CheckCircle,
    MessageCircle, Activity, Settings2, GraduationCap,
    UserCheck, Timer, SmilePlus, HandMetal, ArrowLeftRight, Send,
    Upload, FileText, Star, Cpu, Coins, ShoppingCart, Check, RefreshCw
} from "lucide-react";

interface TrainingSnippet {
    id: string;
    title: string;
    content: string;
}

interface FewShotExample {
    id: string;
    situation: string;
    customer: string;
    reply: string;
}

interface PersonalityMode {
    id: string;
    name: string;
    emoji: string;
    description: string;
    tone: string;
}

interface AgentConfig {
    enabled: boolean;
    whatsapp_enabled: boolean;
    system_prompt: string;
    training_snippets: TrainingSnippet[];
    allowed_operations: string[];
    auto_reply: boolean;
    business_hours_only: boolean;
    max_tokens: number;
    agent_name: string;
    personality_modes: PersonalityMode[];
    active_personality: string;
    handoff_triggers: string[];
    resume_triggers: string[];
    handoff_timeout_seconds: number;
    ai_provider?: "gemini" | "openai";
    ai_model?: string;
    show_bot_prefix?: boolean;
    human_pause_minutes?: number;
    out_of_hours_message?: string;
    monthly_token_limit?: number;
    style_guide?: string;
    few_shot_examples?: FewShotExample[];
    whatsapp_status?: 'disconnected' | 'connecting' | 'qr' | 'connected';
    whatsapp_qr?: string | null;
    whatsapp_phone?: string | null;
}

interface AvailableProviders {
    gemini: boolean;
    openai: boolean;
    groq: boolean;
}

interface MonthlyUsageStats {
    totalTokens: number;
    promptTokens: number;
    cachedTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
    requestsCount: number;
    tableReady: boolean;
}

interface SyncedWaStats {
    totalMessages: number;
    humanBusinessReplies: number;
    customerMessages: number;
    conversationsWithHumanReplies: number;
}

interface ExtractedTrainingResult {
    summary: string;
    style_guide: string;
    few_shot_examples: FewShotExample[];
    suggested_snippets: TrainingSnippet[];
    stats: {
        total_messages_analyzed: number;
        conversations_analyzed: number;
        business_replies_found: number;
    };
}

interface Conversation {
    id: string;
    sender_phone: string;
    sender_name: string;
    last_message_at: string;
    status: string;
    metadata?: any;
    created_at: string;
}

interface AgentAction {
    id: string;
    action_type: string;
    action_details: any;
    source: string;
    sender_phone: string;
    status: string;
    created_at: string;
}

const OPERATION_LABELS: Record<string, { label: string; description: string; icon: any }> = {
    view_products: { label: "Ver Productos", description: "Consultar menú, precios y disponibilidad", icon: Eye },
    view_orders: { label: "Ver Pedidos", description: "Consultar pedidos activos y su estado", icon: MessageSquare },
    modify_products: { label: "Modificar Productos", description: "Activar/desactivar productos, cambiar precios", icon: Pencil },
    create_orders: { label: "Crear Pedidos", description: "Generar nuevos pedidos desde WhatsApp", icon: Plus },
    manage_discounts: { label: "Gestionar Descuentos", description: "Aplicar y gestionar promociones", icon: Zap },
};

const PROMPT_TEMPLATES = [
    {
        name: "🍕 Restaurante / Delivery",
        prompt: `Sos el asistente de nuestro restaurante. Ayudás a los clientes a ver el menú, consultar precios, conocer tiempos de entrega y hacer pedidos. Siempre sugerí los platos más populares cuando el cliente no sepa qué pedir.`
    },
    {
        name: "💇 Salón de Belleza",
        prompt: `Sos el asistente de nuestro salón de belleza. Ayudás a los clientes a consultar servicios disponibles, precios y horarios. Siempre preguntá si necesitan turno y ofrecé las opciones más populares.`
    },
    {
        name: "🏪 Tienda General",
        prompt: `Sos el asistente de nuestra tienda. Ayudás a los clientes a encontrar productos, consultar precios y disponibilidad. Ofrecé alternativas cuando un producto no esté disponible.`
    },
];

export default function AgenteIAPage() {
    const { sucursalId } = useTenant();
    const [config, setConfig] = useState<AgentConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
    const [activeSection, setActiveSection] = useState<"config" | "training" | "permissions" | "conversations" | "actions" | "simulator">("config");

    // Training snippets edit
    const [editingSnippet, setEditingSnippet] = useState<TrainingSnippet | null>(null);
    const [newSnippetTitle, setNewSnippetTitle] = useState("");
    const [newSnippetContent, setNewSnippetContent] = useState("");

    // Conversations
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
    const [messages, setMessages] = useState<any[]>([]);

    // Actions
    const [actions, setActions] = useState<AgentAction[]>([]);

    // Handoff triggers
    const [newHandoffTrigger, setNewHandoffTrigger] = useState("");
    const [newResumeTrigger, setNewResumeTrigger] = useState("");

    // Personality editing
    const [editingPersonality, setEditingPersonality] = useState<string | null>(null);

    // Simulator State
    const [simulatorMessages, setSimulatorMessages] = useState<{ role: "user" | "assistant", content: string, action?: any }[]>([]);
    const [simCart, setSimCart] = useState<any | null>(null);
    const [simInput, setSimInput] = useState("");
    const [simLoading, setSimLoading] = useState(false);

    // Providers & Token Usage
    const [availableProviders, setAvailableProviders] = useState<AvailableProviders>({
        gemini: true,
        openai: false,
        groq: false,
    });
    const [usageStats, setUsageStats] = useState<MonthlyUsageStats | null>(null);

    // WhatsApp Training State
    const [syncedStats, setSyncedStats] = useState<SyncedWaStats | null>(null);
    const [waTxtFiles, setWaTxtFiles] = useState<Array<{ name: string; content: string }>>([]);
    const [waPastedText, setWaPastedText] = useState("");
    const [waAuthors, setWaAuthors] = useState<Array<{ name: string; count: number }>>([]);
    const [selectedBusinessAuthors, setSelectedBusinessAuthors] = useState<string[]>([]);
    const [analyzingChats, setAnalyzingChats] = useState(false);
    const [previewingTxt, setPreviewingTxt] = useState(false);
    const [trainingError, setTrainingError] = useState<string | null>(null);
    const [extractedResult, setExtractedResult] = useState<ExtractedTrainingResult | null>(null);
    const [appliedBanner, setAppliedBanner] = useState<string | null>(null);

    // Manual Few-Shot Examples State
    const [newExampleSituation, setNewExampleSituation] = useState("");
    const [newExampleCustomer, setNewExampleCustomer] = useState("");
    const [newExampleReply, setNewExampleReply] = useState("");
    const [addedExampleMsgIds, setAddedExampleMsgIds] = useState<Record<string, boolean>>({});

    // Auto-scroll simulator
    useEffect(() => {
        if (activeSection === "simulator") {
            const el = document.getElementById("sim-bottom");
            if (el) el.scrollIntoView({ behavior: "smooth" });
        }
    }, [simulatorMessages, simLoading, activeSection]);

    // Load config + providers
    const loadConfig = useCallback(async () => {
        if (!sucursalId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/ai/agent-config?sucursal_id=${sucursalId}&section=config`);
            const data = await res.json();
            if (data.success) {
                setConfig(data.config);
                if (data.available_providers) {
                    setAvailableProviders(data.available_providers);
                }
            }
        } catch (err) {
            console.error("Error loading config:", err);
        } finally {
            setLoading(false);
        }
    }, [sucursalId]);

    const loadUsageStats = useCallback(async () => {
        if (!sucursalId) return;
        try {
            const res = await fetch(`/api/ai/agent-config?sucursal_id=${sucursalId}&section=usage`);
            const data = await res.json();
            if (data.success) {
                setUsageStats(data.usage);
                if (data.available_providers) {
                    setAvailableProviders(data.available_providers);
                }
            }
        } catch (err) {
            console.error("Error loading usage:", err);
        }
    }, [sucursalId]);

    const loadSyncedTrainingStats = useCallback(async () => {
        if (!sucursalId) return;
        try {
            const res = await fetch(`/api/ai/train-from-whatsapp?sucursal_id=${sucursalId}`);
            const data = await res.json();
            if (data.success) {
                setSyncedStats(data.stats);
            }
        } catch (err) {
            console.error("Error loading synced WA stats:", err);
        }
    }, [sucursalId]);

    useEffect(() => {
        loadConfig();
        loadUsageStats();
    }, [loadConfig, loadUsageStats]);

    useEffect(() => {
        if (!sucursalId || !config?.whatsapp_enabled || config?.whatsapp_status === 'connected') return;

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/ai/agent-config?sucursal_id=${sucursalId}&section=config`);
                const data = await res.json();
                if (data.success && data.config) {
                    setConfig(prev => {
                        if (!prev) return data.config;
                        // Only update status fields to avoid overwriting user edits in progress
                        return {
                            ...prev,
                            whatsapp_status: data.config.whatsapp_status,
                            whatsapp_qr: data.config.whatsapp_qr,
                            whatsapp_phone: data.config.whatsapp_phone,
                        };
                    });
                }
            } catch (err) {
                console.error("Error polling config:", err);
            }
        }, 4000);

        return () => clearInterval(interval);
    }, [sucursalId, config?.whatsapp_enabled, config?.whatsapp_status]);

    // Save config
    async function handleSave() {
        if (!sucursalId || !config) return;
        setSaving(true);
        setSaveMessage(null);
        try {
            const res = await fetch("/api/ai/agent-config", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sucursal_id: sucursalId, config }),
            });
            const data = await res.json();
            if (data.success) {
                setSaveMessage({ type: "ok", text: "Configuración guardada ✓" });
            } else {
                setSaveMessage({ type: "error", text: data.error || "Error al guardar" });
            }
        } catch {
            setSaveMessage({ type: "error", text: "Error de conexión" });
        } finally {
            setSaving(false);
            setTimeout(() => setSaveMessage(null), 3000);
        }
    }

    // Load conversations
    async function loadConversations() {
        if (!sucursalId) return;
        const res = await fetch(`/api/ai/agent-config?sucursal_id=${sucursalId}&section=conversations`);
        const data = await res.json();
        if (data.success) setConversations(data.conversations);
    }

    // Load messages for a conversation
    async function loadMessages(conversationId: string) {
        if (!sucursalId) return;
        const res = await fetch(`/api/ai/agent-config?sucursal_id=${sucursalId}&section=messages&conversation_id=${conversationId}`);
        const data = await res.json();
        if (data.success) setMessages(data.messages);
    }

    // Load actions
    async function loadActions() {
        if (!sucursalId) return;
        const res = await fetch(`/api/ai/agent-config?sucursal_id=${sucursalId}&section=actions`);
        const data = await res.json();
        if (data.success) setActions(data.actions);
    }

    // Resume a conversation from handoff
    async function handleResumeConversation(conversationId: string) {
        if (!sucursalId) return;
        try {
            await fetch("/api/ai/agent-config", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sucursal_id: sucursalId,
                    section: "resume_conversation",
                    conversation_id: conversationId,
                }),
            });
            loadConversations();
        } catch { }
    }

    useEffect(() => {
        if (activeSection === "conversations") loadConversations();
        if (activeSection === "actions") loadActions();
        if (activeSection === "training") loadSyncedTrainingStats();
        if (activeSection === "config") loadUsageStats();
    }, [activeSection, sucursalId, loadSyncedTrainingStats, loadUsageStats]);

    // WhatsApp Training Handlers
    async function previewTxtAuthors(texts: string[]) {
        if (!sucursalId || texts.length === 0) {
            setWaAuthors([]);
            setSelectedBusinessAuthors([]);
            return;
        }
        setPreviewingTxt(true);
        setTrainingError(null);
        try {
            const res = await fetch("/api/ai/train-from-whatsapp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sucursalId,
                    mode: "preview_txt",
                    rawTexts: texts,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setWaAuthors(data.authors || []);
                if (data.authors && data.authors.length > 0 && selectedBusinessAuthors.length === 0) {
                    setSelectedBusinessAuthors([data.authors[0].name]);
                }
            }
        } catch (err: any) {
            setTrainingError(err.message || "Error leyendo archivo");
        } finally {
            setPreviewingTxt(false);
        }
    }

    async function handleTxtFilesUpload(files: FileList | null) {
        if (!files || files.length === 0) return;
        const loaded: Array<{ name: string; content: string }> = [];
        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            const content = await f.text();
            loaded.push({ name: f.name, content });
        }
        const merged = [...waTxtFiles, ...loaded];
        setWaTxtFiles(merged);
        const allTexts = [
            ...merged.map((x) => x.content),
            ...(waPastedText.trim() ? [waPastedText.trim()] : []),
        ];
        await previewTxtAuthors(allTexts);
    }

    async function handleAnalyzeWhatsApp(source: "db" | "txt" | "both") {
        if (!sucursalId) return;
        setAnalyzingChats(true);
        setTrainingError(null);
        setExtractedResult(null);
        setAppliedBanner(null);

        const rawTexts = [
            ...waTxtFiles.map((f) => f.content),
            ...(waPastedText.trim() ? [waPastedText.trim()] : []),
        ];

        try {
            const res = await fetch("/api/ai/train-from-whatsapp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sucursalId,
                    mode: "analyze",
                    source,
                    rawTexts,
                    businessNames: selectedBusinessAuthors,
                }),
            });
            const data = await res.json();
            if (data.success && data.result) {
                setExtractedResult(data.result);
                loadUsageStats();
            } else {
                setTrainingError(data.error || "No se pudieron analizar los chats");
            }
        } catch (err: any) {
            setTrainingError(err.message || "Error de conexión al analizar chats");
        } finally {
            setAnalyzingChats(false);
        }
    }

    function applyExtractedTraining(mode: "all" | "style" | "examples" | "snippets") {
        if (!config || !extractedResult) return;
        const nextConfig: AgentConfig = { ...config };

        if (mode === "all" || mode === "style") {
            nextConfig.style_guide = extractedResult.style_guide;
        }
        if (mode === "all" || mode === "examples") {
            const existing = nextConfig.few_shot_examples || [];
            const seen = new Set(existing.map((e) => e.customer.toLowerCase() + "||" + e.reply.toLowerCase()));
            const toAdd = extractedResult.few_shot_examples.filter(
                (e) => !seen.has(e.customer.toLowerCase() + "||" + e.reply.toLowerCase())
            );
            nextConfig.few_shot_examples = [...existing, ...toAdd];
        }
        if (mode === "all" || mode === "snippets") {
            const existing = nextConfig.training_snippets || [];
            const seenTitles = new Set(existing.map((s) => s.title.toLowerCase()));
            const toAdd = extractedResult.suggested_snippets.filter(
                (s) => !seenTitles.has(s.title.toLowerCase())
            );
            nextConfig.training_snippets = [...existing, ...toAdd];
        }

        setConfig(nextConfig);
        setAppliedBanner("Cambios aplicados en memoria. Hacé clic en \"Guardar Cambios\" arriba a la derecha para activarlos.");
    }

    function addManualExample() {
        if (!config || !newExampleCustomer.trim() || !newExampleReply.trim()) return;
        const example: FewShotExample = {
            id: `ex-${Date.now()}`,
            situation: newExampleSituation.trim() || "Conversación",
            customer: newExampleCustomer.trim(),
            reply: newExampleReply.trim(),
        };
        setConfig({
            ...config,
            few_shot_examples: [...(config.few_shot_examples || []), example],
        });
        setNewExampleSituation("");
        setNewExampleCustomer("");
        setNewExampleReply("");
    }

    function removeExample(id: string) {
        if (!config) return;
        setConfig({
            ...config,
            few_shot_examples: (config.few_shot_examples || []).filter((e) => e.id !== id),
        });
    }

    function addConversationMessageAsExample(msgKey: string, customerText: string, replyText: string) {
        if (!config || !customerText.trim() || !replyText.trim()) return;
        const cleanReply = replyText.replace(/^(?:🤖|⚡)\s+/u, "").trim();
        const example: FewShotExample = {
            id: `conv-ex-${Date.now()}`,
            situation: "Chat real guardado",
            customer: customerText.trim(),
            reply: cleanReply,
        };
        setConfig({
            ...config,
            few_shot_examples: [...(config.few_shot_examples || []), example],
        });
        setAddedExampleMsgIds((prev) => ({ ...prev, [msgKey]: true }));
        setSaveMessage({ type: "ok", text: "Ejemplo agregado. No olvides pulsar Guardar Cambios." });
        setTimeout(() => setSaveMessage(null), 3500);
    }

    // Toggle operations
    function toggleOperation(op: string) {
        if (!config) return;
        const ops = config.allowed_operations.includes(op)
            ? config.allowed_operations.filter(o => o !== op)
            : [...config.allowed_operations, op];
        setConfig({ ...config, allowed_operations: ops });
    }

    // Snippet management
    function addSnippet() {
        if (!config || !newSnippetTitle.trim() || !newSnippetContent.trim()) return;
        const snippet: TrainingSnippet = {
            id: Date.now().toString(),
            title: newSnippetTitle.trim(),
            content: newSnippetContent.trim(),
        };
        setConfig({ ...config, training_snippets: [...config.training_snippets, snippet] });
        setNewSnippetTitle("");
        setNewSnippetContent("");
    }

    function removeSnippet(id: string) {
        if (!config) return;
        setConfig({ ...config, training_snippets: config.training_snippets.filter(s => s.id !== id) });
    }

    function updateSnippet(snippet: TrainingSnippet) {
        if (!config) return;
        setConfig({
            ...config,
            training_snippets: config.training_snippets.map(s => s.id === snippet.id ? snippet : s)
        });
        setEditingSnippet(null);
    }

    // Handoff trigger management
    function addHandoffTrigger() {
        if (!config || !newHandoffTrigger.trim()) return;
        setConfig({ ...config, handoff_triggers: [...(config.handoff_triggers || []), newHandoffTrigger.trim().toLowerCase()] });
        setNewHandoffTrigger("");
    }
    function removeHandoffTrigger(t: string) {
        if (!config) return;
        setConfig({ ...config, handoff_triggers: (config.handoff_triggers || []).filter(x => x !== t) });
    }
    function addResumeTrigger() {
        if (!config || !newResumeTrigger.trim()) return;
        setConfig({ ...config, resume_triggers: [...(config.resume_triggers || []), newResumeTrigger.trim().toLowerCase()] });
        setNewResumeTrigger("");
    }
    function removeResumeTrigger(t: string) {
        if (!config) return;
        setConfig({ ...config, resume_triggers: (config.resume_triggers || []).filter(x => x !== t) });
    }

    // Personality management
    function updatePersonality(id: string, field: string, value: string) {
        if (!config) return;
        setConfig({
            ...config,
            personality_modes: (config.personality_modes || []).map(p =>
                p.id === id ? { ...p, [field]: value } : p
            ),
        });
    }

    // Simulator logic (with full multi-turn history & cart memory)
    async function handleSimSend() {
        if (!simInput.trim() || !sucursalId || simLoading) return;

        const userMsg = simInput.trim();
        const historySnapshot = simulatorMessages.map((m) => ({
            role: m.role,
            content: m.content,
        }));
        setSimInput("");
        setSimulatorMessages(prev => [...prev, { role: "user", content: userMsg }]);
        setSimLoading(true);

        try {
            const res = await fetch("/api/ai/test-agent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sucursalId,
                    text: userMsg,
                    conversationHistory: historySnapshot,
                    cartState: simCart,
                }),
            });
            const data = await res.json();
            
            if (data.success) {
                if (data.cart !== undefined) {
                    setSimCart(data.cart);
                }
                setSimulatorMessages(prev => [...prev, { 
                    role: "assistant", 
                    content: data.reply,
                    action: data.action
                }]);
            } else {
                setSimulatorMessages(prev => [...prev, { 
                    role: "assistant", 
                    content: "❌ Error: " + (data.error || "No se pudo conectar con el agente.")
                }]);
            }
        } catch {
            setSimulatorMessages(prev => [...prev, { 
                role: "assistant", 
                content: "❌ Error de conexión al simular."
            }]);
        } finally {
            setSimLoading(false);
        }
    }

    function clearSimulator() {
        setSimulatorMessages([]);
        setSimCart(null);
        setSimInput("");
    }

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center p-12">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center">
                        <Loader2 size={28} className="animate-spin text-purple-500" />
                    </div>
                    <p className="text-sm text-gray-400 font-medium">Cargando configuración del agente...</p>
                </div>
            </div>
        );
    }

    if (!config) {
        return (
            <div className="flex-1 flex items-center justify-center p-12">
                <div className="text-center space-y-4">
                    <AlertCircle size={48} className="text-red-400 mx-auto" />
                    <p className="text-gray-600">No se pudo cargar la configuración del agente.</p>
                    <button onClick={loadConfig} className="text-sm text-purple-600 font-medium hover:underline">Reintentar</button>
                </div>
            </div>
        );
    }

    const sections = [
        { id: "config", label: "General", icon: Settings2, badge: config.enabled ? "ON" : "OFF" },
        { id: "simulator", label: "Simulador", icon: MessageSquare, badge: "Test" },
        { id: "training", label: "Entrenamiento", icon: GraduationCap, badge: String(config.training_snippets.length) },
        { id: "permissions", label: "Permisos", icon: Shield, badge: String(config.allowed_operations.length) },
        { id: "conversations", label: "Conversaciones", icon: MessageCircle },
        { id: "actions", label: "Historial", icon: Activity },
    ];

    return (
        <div className="flex-1 p-6 space-y-6 max-w-6xl mx-auto w-full">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-200">
                        <Bot size={28} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Agente IA</h1>
                        <p className="text-sm text-gray-500">Configurá tu asistente virtual autónomo para WhatsApp</p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.97] disabled:opacity-50"
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Guardar Cambios
                </button>
            </div>

            {/* Save feedback */}
            {saveMessage && (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium animate-in slide-in-from-top-2 ${
                    saveMessage.type === "ok" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
                }`}>
                    {saveMessage.type === "ok" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    {saveMessage.text}
                </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100 overflow-x-auto">
                {sections.map(s => {
                    const Icon = s.icon;
                    const active = activeSection === s.id;
                    return (
                        <button
                            key={s.id}
                            onClick={() => setActiveSection(s.id as any)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                                active ? "bg-white text-purple-700 shadow-sm border border-gray-200" : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
                            }`}
                        >
                            <Icon size={16} />
                            {s.label}
                            {s.badge && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                    active ? "bg-purple-100 text-purple-600" : "bg-gray-200 text-gray-500"
                                }`}>{s.badge}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ═══ SECTION: General Config ═══ */}
            {activeSection === "config" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

                    {/* Agent Identity */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <SmilePlus size={18} className="text-purple-500" /> Identidad del Agente
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre del Agente</label>
                                <input
                                    value={config.agent_name || ""}
                                    onChange={e => setConfig({ ...config, agent_name: e.target.value })}
                                    placeholder="Ej: Luna, Asistente, María..."
                                    className="w-full max-w-md border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-300 bg-gray-50"
                                />
                                <p className="text-xs text-gray-400 mt-1">El agente se presentará con este nombre ante los clientes</p>
                            </div>
                        </div>
                    </div>

                    {/* Personality Modes */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                        <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                            <Sparkles size={18} className="text-purple-500" /> Personalidad
                        </h3>
                        <p className="text-xs text-gray-500 mb-5">
                            Elegí un modo de personalidad y personalizá el tono de comunicación de tu agente.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            {(config.personality_modes || []).map(p => {
                                const isActive = config.active_personality === p.id;
                                const isEditing = editingPersonality === p.id;
                                return (
                                    <div
                                        key={p.id}
                                        className={`relative rounded-2xl border-2 p-5 transition-all cursor-pointer ${
                                            isActive
                                                ? "border-purple-400 bg-purple-50/60 shadow-md shadow-purple-100"
                                                : "border-gray-200 bg-gray-50/50 hover:border-gray-300"
                                        }`}
                                        onClick={() => !isEditing && setConfig({ ...config, active_personality: p.id })}
                                    >
                                        {isActive && (
                                            <div className="absolute -top-2.5 right-3 bg-purple-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                                Activo
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-2xl">{p.emoji}</span>
                                                {isEditing ? (
                                                    <input
                                                        value={p.name}
                                                        onChange={e => updatePersonality(p.id, "name", e.target.value)}
                                                        onClick={e => e.stopPropagation()}
                                                        className="font-bold text-gray-800 bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm w-28"
                                                    />
                                                ) : (
                                                    <span className="font-bold text-gray-800">{p.name}</span>
                                                )}
                                            </div>
                                            <button
                                                onClick={e => { e.stopPropagation(); setEditingPersonality(isEditing ? null : p.id); }}
                                                className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-white rounded-lg transition-colors"
                                            >
                                                <Pencil size={13} />
                                            </button>
                                        </div>

                                        {isEditing ? (
                                            <div className="space-y-2" onClick={e => e.stopPropagation()}>
                                                <input
                                                    value={p.description}
                                                    onChange={e => updatePersonality(p.id, "description", e.target.value)}
                                                    className="w-full text-xs bg-white border border-gray-200 rounded-lg px-3 py-2"
                                                    placeholder="Descripción corta..."
                                                />
                                                <textarea
                                                    value={p.tone}
                                                    onChange={e => updatePersonality(p.id, "tone", e.target.value)}
                                                    rows={4}
                                                    className="w-full text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 resize-y"
                                                    placeholder="Instrucciones de tono para la IA..."
                                                />
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-500 leading-relaxed">{p.description}</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Master Toggle */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <Zap size={18} className="text-purple-500" /> Estado del Agente
                        </h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100">
                                <div>
                                    <p className="font-medium text-gray-800">Agente IA Activo</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Habilita o deshabilita el agente por completo</p>
                                </div>
                                <button
                                    onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                                    className={`p-1 rounded-full transition-colors ${config.enabled ? "text-purple-600" : "text-gray-400"}`}
                                >
                                    {config.enabled
                                        ? <ToggleRight size={40} strokeWidth={1.5} />
                                        : <ToggleLeft size={40} strokeWidth={1.5} />
                                    }
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                                        <Phone size={18} className="text-green-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-800">Conexión WhatsApp</p>
                                        <p className="text-xs text-gray-500 mt-0.5">Responder mensajes de clientes por WhatsApp</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setConfig({ ...config, whatsapp_enabled: !config.whatsapp_enabled })}
                                    className={`p-1 rounded-full transition-colors ${config.whatsapp_enabled ? "text-green-600" : "text-gray-400"}`}
                                    disabled={!config.enabled}
                                >
                                    {config.whatsapp_enabled
                                        ? <ToggleRight size={40} strokeWidth={1.5} />
                                        : <ToggleLeft size={40} strokeWidth={1.5} />
                                    }
                                </button>
                            </div>

                            {config.whatsapp_enabled && (
                                <div className="p-4 rounded-xl bg-purple-50/30 border border-purple-100 flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold uppercase text-purple-700 tracking-wider">Sincronización WhatsApp</span>
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            config.whatsapp_status === 'connected' ? 'bg-green-100 text-green-800' :
                                            config.whatsapp_status === 'connecting' ? 'bg-blue-100 text-blue-800 animate-pulse' :
                                            config.whatsapp_status === 'qr' ? 'bg-amber-100 text-amber-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${
                                                config.whatsapp_status === 'connected' ? 'bg-green-500' :
                                                config.whatsapp_status === 'connecting' ? 'bg-blue-500' :
                                                config.whatsapp_status === 'qr' ? 'bg-amber-500' :
                                                'bg-gray-400'
                                            }`} />
                                            {config.whatsapp_status === 'connected' ? 'Conectado' :
                                             config.whatsapp_status === 'connecting' ? 'Conectando...' :
                                             config.whatsapp_status === 'qr' ? 'Esperando QR' :
                                             'Desconectado'}
                                        </span>
                                    </div>

                                    {config.whatsapp_status === 'connected' && config.whatsapp_phone && (
                                        <div className="text-sm text-gray-700 bg-white p-3 rounded-lg border border-green-100 flex items-center gap-2">
                                            <span className="text-green-600 font-bold">✓</span>
                                            <span>Vinculado al número: <strong>+{config.whatsapp_phone}</strong></span>
                                        </div>
                                    )}

                                    {config.whatsapp_status === 'qr' && config.whatsapp_qr && (
                                        <div className="flex flex-col items-center gap-3 p-3 bg-white rounded-lg border border-amber-100">
                                            <p className="text-xs text-gray-600 text-center font-medium">
                                                Escaneá este código QR con la app de WhatsApp desde tu celular (Dispositivos vinculados) para sincronizar:
                                            </p>
                                            <img
                                                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(config.whatsapp_qr)}`}
                                                alt="WhatsApp QR Code"
                                                className="w-48 h-48 border rounded-lg bg-white p-2 shadow-sm"
                                            />
                                        </div>
                                    )}

                                    {config.whatsapp_status === 'connecting' && (
                                        <div className="flex flex-col items-center justify-center p-4 gap-2 bg-white rounded-lg border">
                                            <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
                                            <p className="text-xs text-gray-500">Conectando servicio de WhatsApp...</p>
                                        </div>
                                    )}

                                    {(!config.whatsapp_status || config.whatsapp_status === 'disconnected') && (
                                        <div className="text-xs text-gray-600 bg-white p-3 rounded-lg border border-gray-100 flex flex-col gap-2">
                                            <p>Ejecutá el puente de WhatsApp en tu terminal local para sincronizar los mensajes.</p>
                                        </div>
                                    )}

                                    <div className="pt-2 border-t border-purple-100/50 mt-1">
                                        <p className="text-xs font-medium text-purple-800 mb-2">Descargas del Agente:</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <a
                                                href="/downloads/agente-whatsapp.zip"
                                                download
                                                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-colors"
                                            >
                                                Descargar Agente (.ZIP)
                                            </a>
                                            <a
                                                href="/downloads/agente-whatsapp/Iniciar-Agente-WhatsApp.bat"
                                                download
                                                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition-colors border border-gray-200"
                                            >
                                                Archivo .BAT
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                                        <Clock size={18} className="text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-800">Solo Horario Comercial</p>
                                        <p className="text-xs text-gray-500 mt-0.5">El agente solo responde dentro del horario configurado</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setConfig({ ...config, business_hours_only: !config.business_hours_only })}
                                    className={`p-1 rounded-full transition-colors ${config.business_hours_only ? "text-amber-600" : "text-gray-400"}`}
                                >
                                    {config.business_hours_only
                                        ? <ToggleRight size={40} strokeWidth={1.5} />
                                        : <ToggleLeft size={40} strokeWidth={1.5} />
                                    }
                                </button>
                            </div>

                            {config.business_hours_only && (
                                <div className="p-4 rounded-xl bg-amber-50/40 border border-amber-100 space-y-2">
                                    <label className="block text-xs font-semibold text-amber-800">
                                        Mensaje fuera de horario (opcional)
                                    </label>
                                    <textarea
                                        value={config.out_of_hours_message || ""}
                                        onChange={e => setConfig({ ...config, out_of_hours_message: e.target.value })}
                                        rows={2}
                                        placeholder="Ej: ¡Hola! Ahora estamos cerrados. Abrimos a las 19:30 hs, apenas abramos te respondemos."
                                        className="w-full border border-amber-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                                    />
                                </div>
                            )}

                            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                                        <Bot size={18} className="text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-800">Mostrar prefijo 🤖 en las respuestas</p>
                                        <p className="text-xs text-gray-500 mt-0.5">Desactivado para que responda más parecido a un humano</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setConfig({ ...config, show_bot_prefix: !config.show_bot_prefix })}
                                    className={`p-1 rounded-full transition-colors ${config.show_bot_prefix ? "text-purple-600" : "text-gray-400"}`}
                                >
                                    {config.show_bot_prefix
                                        ? <ToggleRight size={40} strokeWidth={1.5} />
                                        : <ToggleLeft size={40} strokeWidth={1.5} />
                                    }
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Motor IA & Consumo Mensual */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                <Cpu size={18} className="text-purple-500" /> Motor IA y Consumo Mensual
                            </h3>
                            <button
                                onClick={loadUsageStats}
                                className="text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
                            >
                                <RefreshCw size={12} /> Actualizar
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Proveedor Principal</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setConfig({ ...config, ai_provider: "gemini", ai_model: "gemini-2.5-flash" })}
                                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                                            (config.ai_provider || "gemini") === "gemini"
                                                ? "border-purple-400 bg-purple-50/50"
                                                : "border-gray-200 bg-gray-50 hover:border-gray-300"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-sm text-gray-800">Google Gemini</span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                                availableProviders.gemini ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                                            }`}>
                                                {availableProviders.gemini ? "Activa" : "Sin key"}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-gray-500 mt-1">Audios e imágenes nativos</p>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setConfig({ ...config, ai_provider: "openai", ai_model: "gpt-4.1-mini" })}
                                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                                            config.ai_provider === "openai"
                                                ? "border-purple-400 bg-purple-50/50"
                                                : "border-gray-200 bg-gray-50 hover:border-gray-300"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-sm text-gray-800">OpenAI GPT</span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                                availableProviders.openai ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"
                                            }`}>
                                                {availableProviders.openai ? "Activa" : "Sin key"}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-gray-500 mt-1">Máxima precisión en pedidos</p>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Modelo</label>
                                    <select
                                        value={config.ai_model || ((config.ai_provider || "gemini") === "openai" ? "gpt-4.1-mini" : "gemini-2.5-flash")}
                                        onChange={e => setConfig({ ...config, ai_model: e.target.value })}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-300"
                                    >
                                        {(config.ai_provider || "gemini") === "openai" ? (
                                            <>
                                                <option value="gpt-4.1-mini">GPT-4.1 mini (Recomendado — $0.40 / $1.60 M)</option>
                                                <option value="gpt-5-mini">GPT-5 mini ($0.25 / $2.00 M)</option>
                                                <option value="gpt-4o-mini">GPT-4o mini ($0.15 / $0.60 M)</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recomendado — $0.30 / $2.50 M)</option>
                                                <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite (Económico — $0.10 / $0.40 M)</option>
                                                <option value="gemini-2.5-pro">Gemini 2.5 Pro ($1.25 / $10.00 M)</option>
                                            </>
                                        )}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Límite mensual de tokens (0 = ilimitado)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="100000"
                                        value={config.monthly_token_limit ?? 0}
                                        onChange={e => setConfig({ ...config, monthly_token_limit: Number(e.target.value) })}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-300"
                                    />
                                </div>
                            </div>
                        </div>

                        {usageStats && (
                            <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                                <div>
                                    <p className="text-[11px] text-gray-500 flex items-center gap-1">
                                        <Coins size={12} className="text-purple-500" /> Tokens del mes
                                    </p>
                                    <p className="text-lg font-bold text-gray-800">
                                        {new Intl.NumberFormat("es-AR").format(usageStats.totalTokens)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[11px] text-gray-500">Costo estimado (USD)</p>
                                    <p className="text-lg font-bold text-emerald-700">
                                        US$ {usageStats.estimatedCostUsd.toFixed(4)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[11px] text-gray-500">Interacciones IA</p>
                                    <p className="text-lg font-bold text-gray-800">{usageStats.requestsCount}</p>
                                </div>
                                {!usageStats.tableReady && (
                                    <p className="col-span-3 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                                        Ejecutá la migración <code className="font-mono">supabase/migrations/20261119_ai_agent_v2.sql</code> en Supabase para persistir métricas mensuales.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Handoff Configuration */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                        <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                            <ArrowLeftRight size={18} className="text-purple-500" /> Derivación a Humano
                        </h3>
                        <p className="text-xs text-gray-500 mb-5">
                            Configurá frases que activan la derivación a un operador humano y el retorno al agente.
                        </p>

                        {/* Timeout & Pausa Automática */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                        <Timer size={18} className="text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-800 text-sm">Timeout por pedido de humano</p>
                                        <p className="text-xs text-gray-500">Si nadie contesta tras derivar, el bot retoma</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 ml-[52px]">
                                    <input
                                        type="number"
                                        value={config.handoff_timeout_seconds || 0}
                                        onChange={e => setConfig({ ...config, handoff_timeout_seconds: Number(e.target.value) })}
                                        className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                                        min="0"
                                    />
                                    <span className="text-sm text-gray-500 font-medium">segundos</span>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                                        <UserCheck size={18} className="text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-800 text-sm">Pausa si responde un operador</p>
                                        <p className="text-xs text-gray-500">Cuando respondés manual desde el celular, el bot se silencia</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 ml-[52px]">
                                    <input
                                        type="number"
                                        value={config.human_pause_minutes ?? 15}
                                        onChange={e => setConfig({ ...config, human_pause_minutes: Number(e.target.value) })}
                                        className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                                        min="1"
                                    />
                                    <span className="text-sm text-gray-500 font-medium">minutos</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Handoff Triggers */}
                            <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                    <HandMetal size={14} className="text-orange-500" /> Frases para derivar a humano
                                </h4>
                                <div className="space-y-2 mb-3">
                                    {(config.handoff_triggers || []).map(t => (
                                        <div key={t} className="flex items-center gap-2 group">
                                            <span className="flex-1 text-xs bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg border border-orange-100">
                                                &quot;{t}&quot;
                                            </span>
                                            <button onClick={() => removeHandoffTrigger(t)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        value={newHandoffTrigger}
                                        onChange={e => setNewHandoffTrigger(e.target.value)}
                                        onKeyDown={e => e.key === "Enter" && addHandoffTrigger()}
                                        placeholder="Ej: quiero hablar con Juan"
                                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
                                    />
                                    <button onClick={addHandoffTrigger} disabled={!newHandoffTrigger.trim()} className="px-3 py-2 bg-orange-50 text-orange-600 rounded-lg text-xs font-medium hover:bg-orange-100 disabled:opacity-40 transition-colors">
                                        <Plus size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Resume Triggers */}
                            <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                    <UserCheck size={14} className="text-green-500" /> Frases para volver al agente
                                </h4>
                                <div className="space-y-2 mb-3">
                                    {(config.resume_triggers || []).map(t => (
                                        <div key={t} className="flex items-center gap-2 group">
                                            <span className="flex-1 text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-lg border border-green-100">
                                                &quot;{t}&quot;
                                            </span>
                                            <button onClick={() => removeResumeTrigger(t)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        value={newResumeTrigger}
                                        onChange={e => setNewResumeTrigger(e.target.value)}
                                        onKeyDown={e => e.key === "Enter" && addResumeTrigger()}
                                        placeholder="Ej: hablar con el bot"
                                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
                                    />
                                    <button onClick={addResumeTrigger} disabled={!newResumeTrigger.trim()} className="px-3 py-2 bg-green-50 text-green-600 rounded-lg text-xs font-medium hover:bg-green-100 disabled:opacity-40 transition-colors">
                                        <Plus size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* System Prompt */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                        <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                            <BookOpen size={18} className="text-purple-500" /> Instrucciones Especiales
                        </h3>
                        <p className="text-xs text-gray-500 mb-4">
                            Instrucciones adicionales específicas de tu negocio.
                        </p>

                        {/* Templates */}
                        <div className="flex gap-2 mb-4 flex-wrap">
                            {PROMPT_TEMPLATES.map(t => (
                                <button
                                    key={t.name}
                                    onClick={() => setConfig({ ...config, system_prompt: t.prompt })}
                                    className="text-xs px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors font-medium border border-purple-100"
                                >
                                    {t.name}
                                </button>
                            ))}
                        </div>

                        <textarea
                            value={config.system_prompt}
                            onChange={e => setConfig({ ...config, system_prompt: e.target.value })}
                            rows={5}
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-300 resize-y bg-gray-50 placeholder:text-gray-400"
                            placeholder="Ej: Siempre sugerí el combo del día. Los envíos se realizan dentro de un radio de 5 km..."
                        />
                    </div>
                </div>
            )}

            {/* ═══ SECTION: Training / Knowledge Base ═══ */}
            {activeSection === "training" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Entrenamiento con chats reales de WhatsApp */}
                    <div className="bg-white rounded-2xl border border-purple-200 p-6 shadow-sm">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                    <Sparkles size={18} className="text-purple-600" /> Entrenar con tus chats reales de WhatsApp
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    La IA analiza cómo atendés hoy a tus clientes para copiar tu tono, modismos, saludos y ejemplos reales (sin copiar precios viejos).
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Opción 1: Historial ya sincronizado */}
                            <div className="p-4 rounded-xl bg-purple-50/40 border border-purple-100 flex flex-col justify-between gap-3">
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-bold uppercase tracking-wider text-purple-700">Opción 1 · Automática</span>
                                        <button
                                            onClick={loadSyncedTrainingStats}
                                            className="text-[11px] text-purple-600 hover:underline flex items-center gap-1"
                                        >
                                            <RefreshCw size={11} /> Actualizar
                                        </button>
                                    </div>
                                    <h4 className="font-semibold text-sm text-gray-800">Usar chats ya sincronizados</h4>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {syncedStats
                                            ? `Detectamos ${syncedStats.humanBusinessReplies} respuestas reales tuyas en ${syncedStats.conversationsWithHumanReplies} conversaciones.`
                                            : "Revisando historial guardado en la base de datos..."}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleAnalyzeWhatsApp("db")}
                                    disabled={analyzingChats || !syncedStats || syncedStats.humanBusinessReplies === 0}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
                                >
                                    {analyzingChats ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                    Analizar historial sincronizado
                                </button>
                            </div>

                            {/* Opción 2: Exportar .txt desde WhatsApp */}
                            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 flex flex-col justify-between gap-3">
                                <div>
                                    <span className="text-xs font-bold uppercase tracking-wider text-gray-600">Opción 2 · Exportar Chat (.txt)</span>
                                    <h4 className="font-semibold text-sm text-gray-800 mt-1">Subir chats exportados de WhatsApp</h4>
                                    <p className="text-[11px] text-gray-500 mt-1">
                                        En WhatsApp: abrí un chat → <strong>⋮ → Más → Exportar chat → Sin archivos</strong>. Podés subir varios <code className="font-mono">.txt</code> juntos.
                                    </p>

                                    <label className="mt-3 flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed border-gray-300 hover:border-purple-400 rounded-xl bg-white cursor-pointer text-xs font-medium text-gray-600 hover:text-purple-700 transition-colors">
                                        <Upload size={14} />
                                        {waTxtFiles.length > 0
                                            ? `${waTxtFiles.length} archivo(s) cargado(s) — Agregar más`
                                            : "Seleccionar archivos .txt de WhatsApp"}
                                        <input
                                            type="file"
                                            accept=".txt"
                                            multiple
                                            className="hidden"
                                            onChange={e => handleTxtFilesUpload(e.target.files)}
                                        />
                                    </label>

                                    {waTxtFiles.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {waTxtFiles.map((f, idx) => (
                                                <span key={idx} className="inline-flex items-center gap-1 text-[11px] bg-white border border-gray-200 px-2 py-0.5 rounded-lg text-gray-700">
                                                    <FileText size={11} className="text-purple-500" />
                                                    {f.name}
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            const next = waTxtFiles.filter((_, i) => i !== idx);
                                                            setWaTxtFiles(next);
                                                            await previewTxtAuthors([
                                                                ...next.map(x => x.content),
                                                                ...(waPastedText.trim() ? [waPastedText.trim()] : []),
                                                            ]);
                                                        }}
                                                        className="text-gray-400 hover:text-red-500"
                                                    >
                                                        <X size={11} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    <textarea
                                        value={waPastedText}
                                        onChange={e => setWaPastedText(e.target.value)}
                                        rows={2}
                                        placeholder="O pegá acá fragmentos de un chat exportado..."
                                        className="w-full mt-2 border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                                    />
                                    {waPastedText.trim().length > 20 && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                previewTxtAuthors([
                                                    ...waTxtFiles.map(x => x.content),
                                                    waPastedText.trim(),
                                                ])
                                            }
                                            disabled={previewingTxt}
                                            className="mt-1 text-[11px] text-purple-600 font-semibold hover:underline"
                                        >
                                            {previewingTxt ? "Detectando autores..." : "Detectar nombres del chat pegado"}
                                        </button>
                                    )}
                                </div>

                                {waAuthors.length > 0 && (
                                    <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-2">
                                        <p className="text-[11px] font-semibold text-gray-700">
                                            ¿Cuál(es) nombre(s) corresponden a TU negocio?
                                        </p>
                                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                                            {waAuthors.slice(0, 12).map(a => {
                                                const checked = selectedBusinessAuthors.includes(a.name);
                                                return (
                                                    <button
                                                        type="button"
                                                        key={a.name}
                                                        onClick={() => {
                                                            setSelectedBusinessAuthors(prev =>
                                                                checked ? prev.filter(x => x !== a.name) : [...prev, a.name]
                                                            );
                                                        }}
                                                        className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                                                            checked
                                                                ? "bg-purple-600 text-white border-purple-600 font-semibold"
                                                                : "bg-gray-50 text-gray-600 border-gray-200 hover:border-purple-300"
                                                        }`}
                                                    >
                                                        {a.name} ({a.count})
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={() =>
                                        handleAnalyzeWhatsApp(
                                            syncedStats && syncedStats.humanBusinessReplies > 0 ? "both" : "txt"
                                        )
                                    }
                                    disabled={
                                        analyzingChats ||
                                        (waTxtFiles.length === 0 && !waPastedText.trim()) ||
                                        (waAuthors.length > 0 && selectedBusinessAuthors.length === 0)
                                    }
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
                                >
                                    {analyzingChats ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                    Analizar archivos y clonar estilo
                                </button>
                            </div>
                        </div>

                        {trainingError && (
                            <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                                <AlertCircle size={15} /> {trainingError}
                            </div>
                        )}

                        {appliedBanner && (
                            <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
                                <CheckCircle size={15} /> {appliedBanner}
                            </div>
                        )}

                        {extractedResult && (
                            <div className="mt-5 p-5 rounded-2xl bg-purple-50/40 border border-purple-200 space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <h4 className="font-bold text-sm text-purple-900">Resultado del análisis</h4>
                                        <p className="text-xs text-purple-700 mt-0.5">
                                            {extractedResult.stats.conversations_analyzed} chats · {extractedResult.stats.business_replies_found} respuestas del negocio analizadas
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => applyExtractedTraining("all")}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-sm"
                                    >
                                        <Check size={14} /> Aplicar todo al agente
                                    </button>
                                </div>

                                <p className="text-xs text-gray-700 bg-white p-3 rounded-xl border border-purple-100">
                                    {extractedResult.summary}
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                    <div className="bg-white p-3 rounded-xl border border-purple-100 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-gray-800">Guía de estilo detectada</span>
                                            <button
                                                onClick={() => applyExtractedTraining("style")}
                                                className="text-purple-600 font-semibold hover:underline"
                                            >
                                                Aplicar solo estilo
                                            </button>
                                        </div>
                                        <p className="text-gray-600 whitespace-pre-line leading-relaxed">
                                            {extractedResult.style_guide}
                                        </p>
                                    </div>

                                    <div className="bg-white p-3 rounded-xl border border-purple-100 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-gray-800">
                                                {extractedResult.few_shot_examples.length} Ejemplos + {extractedResult.suggested_snippets.length} FAQs
                                            </span>
                                            <button
                                                onClick={() => applyExtractedTraining("examples")}
                                                className="text-purple-600 font-semibold hover:underline"
                                            >
                                                Sumar ejemplos
                                            </button>
                                        </div>
                                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                            {extractedResult.few_shot_examples.slice(0, 4).map((ex, i) => (
                                                <div key={i} className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                                                    <p className="text-[10px] font-bold text-purple-600">{ex.situation}</p>
                                                    <p className="text-[11px] text-gray-500">Cliente: {ex.customer}</p>
                                                    <p className="text-[11px] text-gray-800">Local: {ex.reply}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Guía de Estilo Real */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                        <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
                            <SmilePlus size={18} className="text-purple-500" /> Guía de Estilo Real del Negocio
                        </h3>
                        <p className="text-xs text-gray-500 mb-4">
                            Describí (o dejá que la IA genere arriba) cómo saluda, qué modismos usa y cómo trata a los clientes tu equipo.
                        </p>
                        <textarea
                            value={config.style_guide || ""}
                            onChange={e => setConfig({ ...config, style_guide: e.target.value })}
                            rows={4}
                            placeholder="Ej: Saludamos con 'Holaa! Cómo va?'. Tratamos de vos, mensajes cortos y buena onda. Confirmamos siempre el tiempo estimado de demora..."
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-gray-50 resize-y"
                        />
                    </div>

                    {/* Ejemplos Reales de Respuesta (Few-Shot) */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                        <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
                            <Star size={18} className="text-amber-500" /> Ejemplos Reales de Respuesta ({(config.few_shot_examples || []).length})
                        </h3>
                        <p className="text-xs text-gray-500 mb-4">
                            El agente imita el estilo y tono de estos ejemplos sin copiar precios viejos. También podés guardar respuestas desde la pestaña Conversaciones.
                        </p>

                        <div className="space-y-2.5 mb-5 max-h-80 overflow-y-auto pr-1">
                            {(config.few_shot_examples || []).length === 0 ? (
                                <div className="text-center py-6 text-xs text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                                    Aún no cargaste ejemplos reales. Usá el analizador de WhatsApp arriba o agregá uno abajo.
                                </div>
                            ) : (
                                (config.few_shot_examples || []).map((ex) => (
                                    <div key={ex.id} className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/70 flex items-start justify-between gap-3 group">
                                        <div className="space-y-1 flex-1 min-w-0 text-xs">
                                            <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                                                {ex.situation}
                                            </span>
                                            <p className="text-gray-600"><strong>Cliente:</strong> {ex.customer}</p>
                                            <p className="text-gray-800"><strong>Negocio:</strong> {ex.reply}</p>
                                        </div>
                                        <button
                                            onClick={() => removeExample(ex.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="border-t border-gray-200 pt-4 space-y-2.5">
                            <p className="text-xs font-semibold text-gray-700">Agregar ejemplo manualmente</p>
                            <input
                                value={newExampleSituation}
                                onChange={e => setNewExampleSituation(e.target.value)}
                                placeholder="Situación (ej: Saludo inicial / Pedido con demora)"
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                <input
                                    value={newExampleCustomer}
                                    onChange={e => setNewExampleCustomer(e.target.value)}
                                    placeholder="Lo que escribe el cliente..."
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
                                />
                                <input
                                    value={newExampleReply}
                                    onChange={e => setNewExampleReply(e.target.value)}
                                    placeholder="Cómo respondés vos..."
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
                                />
                            </div>
                            <button
                                onClick={addManualExample}
                                disabled={!newExampleCustomer.trim() || !newExampleReply.trim()}
                                className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-medium disabled:opacity-40"
                            >
                                <Plus size={13} /> Agregar ejemplo
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                        <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                            <BookOpen size={18} className="text-purple-500" /> Base de Conocimiento
                        </h3>
                        <p className="text-xs text-gray-500 mb-6">
                            Agregá información que el agente necesita saber: horarios, preguntas frecuentes, políticas, etc.
                        </p>

                        {/* Existing snippets */}
                        <div className="space-y-3 mb-6">
                            {config.training_snippets.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
                                    <GraduationCap size={32} className="mx-auto mb-2 text-gray-300" />
                                    <p>Aún no hay datos de entrenamiento</p>
                                    <p className="text-xs mt-1">Agregá tu primer snippet abajo ↓</p>
                                </div>
                            ) : (
                                config.training_snippets.map(snippet => (
                                    <div key={snippet.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 group hover:border-purple-200 transition-colors">
                                        {editingSnippet?.id === snippet.id ? (
                                            <div className="space-y-3">
                                                <input
                                                    value={editingSnippet.title}
                                                    onChange={e => setEditingSnippet({ ...editingSnippet, title: e.target.value })}
                                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                                                />
                                                <textarea
                                                    value={editingSnippet.content}
                                                    onChange={e => setEditingSnippet({ ...editingSnippet, content: e.target.value })}
                                                    rows={3}
                                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-y"
                                                />
                                                <div className="flex gap-2 justify-end">
                                                    <button onClick={() => setEditingSnippet(null)} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">Cancelar</button>
                                                    <button onClick={() => updateSnippet(editingSnippet)} className="text-xs text-white bg-purple-600 hover:bg-purple-700 px-4 py-1.5 rounded-lg transition-colors font-medium">Guardar</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-semibold text-gray-800 text-sm">{snippet.title}</h4>
                                                    <p className="text-xs text-gray-500 mt-1 whitespace-pre-line line-clamp-3">{snippet.content}</p>
                                                </div>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-3">
                                                    <button
                                                        onClick={() => setEditingSnippet(snippet)}
                                                        className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => removeSnippet(snippet.id)}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Add new snippet */}
                        <div className="border-t border-gray-200 pt-5 space-y-3">
                            <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <Plus size={16} className="text-purple-500" /> Agregar nuevo conocimiento
                            </h4>
                            <input
                                value={newSnippetTitle}
                                onChange={e => setNewSnippetTitle(e.target.value)}
                                placeholder="Título (ej: Horarios de atención)"
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 placeholder:text-gray-400"
                            />
                            <textarea
                                value={newSnippetContent}
                                onChange={e => setNewSnippetContent(e.target.value)}
                                rows={3}
                                placeholder="Contenido (ej: Lunes a Viernes de 9 a 18hs, Sábados de 10 a 14hs)"
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-y placeholder:text-gray-400"
                            />
                            <button
                                onClick={addSnippet}
                                disabled={!newSnippetTitle.trim() || !newSnippetContent.trim()}
                                className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Plus size={14} /> Agregar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ SECTION: Permissions ═══ */}
            {activeSection === "permissions" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                        <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                            <Shield size={18} className="text-purple-500" /> Permisos del Agente
                        </h3>
                        <p className="text-xs text-gray-500 mb-6">
                            Controlá qué operaciones puede realizar el agente de forma autónoma.
                        </p>

                        <div className="space-y-3">
                            {Object.entries(OPERATION_LABELS).map(([op, info]) => {
                                const Icon = info.icon;
                                const isActive = config.allowed_operations.includes(op);
                                return (
                                    <button
                                        key={op}
                                        onClick={() => toggleOperation(op)}
                                        className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                                            isActive
                                                ? "border-purple-200 bg-purple-50/50"
                                                : "border-gray-100 bg-gray-50/50 hover:border-gray-200"
                                        }`}
                                    >
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                            isActive ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-400"
                                        }`}>
                                            <Icon size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-medium text-sm ${isActive ? "text-purple-800" : "text-gray-600"}`}>
                                                {info.label}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5">{info.description}</p>
                                        </div>
                                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
                                            isActive ? "bg-purple-600 border-purple-600" : "border-gray-300"
                                        }`}>
                                            {isActive && <CheckCircle size={14} className="text-white" />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ SECTION: Simulator ═══ */}
            {activeSection === "simulator" && (
                <div className="flex flex-col h-[600px] bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                                <Bot size={20} className="text-purple-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-800 text-sm">Simulador de Agente IA</h3>
                                <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Entorno de prueba con memoria y carrito (Dry-run)</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {simCart && simCart.items && simCart.items.length > 0 && (
                                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700 font-semibold">
                                    <ShoppingCart size={13} />
                                    {simCart.items.reduce((acc: number, it: any) => acc + (it.cantidad || 1), 0)} ítem(s) · ${new Intl.NumberFormat("es-AR").format(simCart.total || 0)}
                                </div>
                            )}
                            <button 
                                onClick={clearSimulator}
                                className="text-xs text-gray-400 hover:text-gray-600 font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                Limpiar Chat
                            </button>
                        </div>
                    </div>

                    {/* Chat Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30 custom-scrollbar">
                        {simulatorMessages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 px-12">
                                <div className="w-16 h-16 rounded-3xl bg-white border border-gray-100 shadow-sm flex items-center justify-center">
                                    <Sparkles size={28} className="text-purple-400" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold text-gray-700">¡Empezá a entrenar a tu agente!</p>
                                    <p className="text-xs text-gray-400">Escribí un mensaje como si fueses un cliente para ver cómo responde la IA y qué acciones detecta.</p>
                                </div>
                                <div className="flex flex-wrap justify-center gap-2 mt-4">
                                    {["¡Hola!", "¿Qué tienen para comer?", "Quiero pedir una pizza", "¿Aceptan tarjeta?"].map(p => (
                                        <button 
                                            key={p} 
                                            onClick={() => { setSimInput(p); }}
                                            className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs text-gray-500 hover:border-purple-300 hover:text-purple-600 transition-all shadow-sm"
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <>
                                {simulatorMessages.map((msg, i) => (
                                    <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start animate-in fade-in slide-in-from-left-2"}`}>
                                        <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm shadow-sm ${
                                            msg.role === "user"
                                                ? "bg-purple-600 text-white rounded-tr-none"
                                                : "bg-white text-gray-700 border border-gray-100 rounded-tl-none"
                                        }`}>
                                            <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>
                                        </div>
                                        
                                        {msg.action && (
                                            <div className="mt-2 w-full max-w-[85%] bg-emerald-50 border border-emerald-100 rounded-xl p-3 animate-in zoom-in-95 duration-300">
                                                <div className="flex items-center gap-2 text-emerald-700 font-bold text-[10px] mb-2 uppercase tracking-tight">
                                                    <Zap size={12} fill="currentColor" /> Acción Detectada (En Pausa)
                                                </div>
                                                <div className="bg-white/80 rounded-lg p-2 font-mono text-[10px] text-gray-600 border border-emerald-50">
                                                    <p className="text-emerald-800 font-bold mb-1">{msg.action.type}()</p>
                                                    <pre className="overflow-x-auto">
                                                        {JSON.stringify(msg.action.details, null, 2)}
                                                    </pre>
                                                </div>
                                                <p className="mt-2 text-[9px] text-emerald-600/70 leading-tight">
                                                    * En modo simulador, las acciones de base de datos están desactivadas para seguridad.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {simLoading && (
                                    <div className="flex items-start gap-2 animate-pulse">
                                        <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
                                            <div className="flex gap-1">
                                                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"></span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div id="sim-bottom"></div>
                            </>
                        )}
                    </div>

                    {/* Footer / Input */}
                    <div className="p-4 bg-white border-t border-gray-100">
                        <div className="relative flex items-center">
                            <input 
                                value={simInput}
                                onChange={e => setSimInput(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && handleSimSend()}
                                placeholder="Escribí un mensaje aquí..."
                                disabled={simLoading}
                                className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:bg-white transition-all disabled:opacity-50"
                            />
                            <button 
                                onClick={handleSimSend}
                                disabled={!simInput.trim() || simLoading}
                                className="absolute right-2 p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-40 disabled:hover:bg-purple-600 transition-all shadow-md active:scale-95"
                            >
                                {simLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                            </button>
                        </div>
                        <p className="text-[9px] text-center text-gray-400 mt-2 font-medium italic">
                            Los mensajes enviados aquí NO son visibles para los clientes de WhatsApp.
                        </p>
                    </div>
                </div>
            )}

            {/* ═══ SECTION: Conversations ═══ */}
            {activeSection === "conversations" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                <MessageCircle size={18} className="text-purple-500" /> Conversaciones Recientes
                            </h3>
                            <button onClick={loadConversations} className="text-xs text-purple-600 hover:text-purple-800 font-medium">Actualizar</button>
                        </div>

                        {conversations.length === 0 ? (
                            <div className="text-center py-12 text-gray-400 text-sm">
                                <MessageCircle size={32} className="mx-auto mb-3 text-gray-300" />
                                <p>No hay conversaciones registradas aún</p>
                                <p className="text-xs mt-1">Las conversaciones aparecerán cuando conectes el agente WhatsApp</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {conversations.map(conv => (
                                    <div key={conv.id}>
                                        <button
                                            onClick={() => {
                                                if (selectedConversation === conv.id) {
                                                    setSelectedConversation(null);
                                                } else {
                                                    setSelectedConversation(conv.id);
                                                    loadMessages(conv.id);
                                                }
                                            }}
                                            className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors text-left"
                                        >
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                                conv.status === "handed_off"
                                                    ? "bg-orange-50 text-orange-600"
                                                    : "bg-green-50 text-green-600"
                                            }`}>
                                                {conv.status === "handed_off" ? <HandMetal size={16} /> : <Phone size={16} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-gray-800 text-sm">{conv.sender_name || conv.sender_phone.replace("@s.whatsapp.net", "")}</p>
                                                <p className="text-xs text-gray-400">{new Date(conv.last_message_at).toLocaleString("es-AR")}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {conv.status === "handed_off" && (
                                                    <button
                                                        onClick={e => { e.stopPropagation(); handleResumeConversation(conv.id); }}
                                                        className="text-[10px] px-2.5 py-1 bg-green-50 text-green-700 rounded-lg font-bold border border-green-200 hover:bg-green-100 transition-colors"
                                                        title="Devolver al agente IA"
                                                    >
                                                        ↩ Retomar IA
                                                    </button>
                                                )}
                                                <span className={`text-[10px] px-2 py-1 rounded-lg font-bold uppercase tracking-wider ${
                                                    conv.status === "handed_off"
                                                        ? "bg-orange-50 text-orange-600"
                                                        : "bg-green-50 text-green-600"
                                                }`}>
                                                    {conv.status === "handed_off" ? "Derivado" : "IA"}
                                                </span>
                                                {selectedConversation === conv.id
                                                    ? <ChevronDown size={16} className="text-gray-400" />
                                                    : <ChevronRight size={16} className="text-gray-400" />
                                                }
                                            </div>
                                        </button>

                                        {selectedConversation === conv.id && (
                                            <div className="px-6 pb-4 bg-gray-50/50 border-t border-gray-100">
                                                <div className="max-h-72 overflow-y-auto space-y-2 py-3 custom-scrollbar">
                                                    {(() => {
                                                        const bubbles: Array<{ key: string; fromMe: boolean; text: string; time: string; prevCustomerText?: string }> = [];
                                                        let lastCustomerText = "";
                                                        messages.forEach((msg, idx) => {
                                                            const timeStr = new Date(msg.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
                                                            if (msg.from_me) {
                                                                const t = (msg.reply_text || msg.message_text || "").trim();
                                                                if (t) {
                                                                    bubbles.push({ key: `${idx}-me`, fromMe: true, text: t, time: timeStr, prevCustomerText: lastCustomerText });
                                                                }
                                                            } else {
                                                                const cust = (msg.message_text || "").trim();
                                                                if (cust) {
                                                                    lastCustomerText = cust;
                                                                    bubbles.push({ key: `${idx}-cust`, fromMe: false, text: cust, time: timeStr });
                                                                }
                                                                const rep = (msg.reply_text || "").trim();
                                                                if (rep) {
                                                                    bubbles.push({ key: `${idx}-rep`, fromMe: true, text: rep, time: timeStr, prevCustomerText: cust || lastCustomerText });
                                                                }
                                                            }
                                                        });

                                                        return bubbles.map((b) => (
                                                            <div key={b.key} className={`flex flex-col ${b.fromMe ? "items-end" : "items-start"}`}>
                                                                <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs ${
                                                                    b.fromMe
                                                                        ? "bg-purple-100 text-purple-800"
                                                                        : "bg-white text-gray-700 border border-gray-200"
                                                                }`}>
                                                                    <p className="whitespace-pre-line">{b.text}</p>
                                                                    <div className="flex items-center justify-between gap-3 mt-1">
                                                                        <p className="text-[10px] opacity-50">{b.time}</p>
                                                                        {b.fromMe && b.prevCustomerText && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => addConversationMessageAsExample(b.key, b.prevCustomerText!, b.text)}
                                                                                disabled={Boolean(addedExampleMsgIds[b.key])}
                                                                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 hover:text-purple-900 disabled:text-emerald-700"
                                                                                title="Guardar este intercambio como ejemplo de entrenamiento"
                                                                            >
                                                                                <Star size={10} />
                                                                                {addedExampleMsgIds[b.key] ? "Guardado" : "Usar como ejemplo"}
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ));
                                                    })()}
                                                    {messages.length === 0 && <p className="text-center text-gray-400 text-xs py-4">No hay mensajes</p>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══ SECTION: Action History ═══ */}
            {activeSection === "actions" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                <Activity size={18} className="text-purple-500" /> Acciones del Agente
                            </h3>
                            <button onClick={loadActions} className="text-xs text-purple-600 hover:text-purple-800 font-medium">Actualizar</button>
                        </div>

                        {actions.length === 0 ? (
                            <div className="text-center py-12 text-gray-400 text-sm">
                                <Activity size={32} className="mx-auto mb-3 text-gray-300" />
                                <p>No hay acciones registradas aún</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {actions.map(action => (
                                    <div key={action.id} className="px-6 py-4 flex items-start gap-4">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                            action.status === "executed" ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"
                                        }`}>
                                            <Zap size={16} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-800 text-sm">{action.action_type.replace(/_/g, " ").replace(/^./, c => c.toUpperCase())}</p>
                                            <p className="text-xs text-gray-500 mt-0.5 truncate">
                                                {JSON.stringify(action.action_details).substring(0, 100)}...
                                            </p>
                                            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
                                                <span>{action.source}</span>
                                                <span>•</span>
                                                <span>{new Date(action.created_at).toLocaleString("es-AR")}</span>
                                            </div>
                                        </div>
                                        <span className={`text-[10px] px-2 py-1 rounded-lg font-bold uppercase tracking-wider ${
                                            action.status === "executed" ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"
                                        }`}>
                                            {action.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
