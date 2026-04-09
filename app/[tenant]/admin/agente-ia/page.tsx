"use client";

import { useEffect, useState, useCallback } from "react";
import { useTenant } from "@/context/TenantContext";
import {
    Bot, MessageSquare, Sparkles, Shield, BookOpen,
    Plus, Trash2, Save, Loader2, ToggleLeft, ToggleRight,
    ChevronDown, ChevronRight, Phone, Clock, Zap,
    Eye, Pencil, X, AlertCircle, CheckCircle,
    MessageCircle, Activity, Settings2, GraduationCap,
    UserCheck, Timer, SmilePlus, HandMetal, ArrowLeftRight
} from "lucide-react";

interface TrainingSnippet {
    id: string;
    title: string;
    content: string;
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
    const [activeSection, setActiveSection] = useState<"config" | "training" | "permissions" | "conversations" | "actions">("config");

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

    // Load config
    const loadConfig = useCallback(async () => {
        if (!sucursalId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/ai/agent-config?sucursal_id=${sucursalId}&section=config`);
            const data = await res.json();
            if (data.success) {
                setConfig(data.config);
            }
        } catch (err) {
            console.error("Error loading config:", err);
        } finally {
            setLoading(false);
        }
    }, [sucursalId]);

    useEffect(() => { loadConfig(); }, [loadConfig]);

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
    }, [activeSection, sucursalId]);

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
                        </div>
                    </div>

                    {/* Handoff Configuration */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                        <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                            <ArrowLeftRight size={18} className="text-purple-500" /> Derivación a Humano
                        </h3>
                        <p className="text-xs text-gray-500 mb-5">
                            Configurá frases que activan la derivación a un operador humano y el retorno al agente.
                        </p>

                        {/* Timeout */}
                        <div className="mb-6 p-4 rounded-xl bg-gray-50 border border-gray-100">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                    <Timer size={18} className="text-blue-600" />
                                </div>
                                <div>
                                    <p className="font-medium text-gray-800 text-sm">Timeout de Derivación</p>
                                    <p className="text-xs text-gray-500">Si el operador no contesta, el agente retoma automáticamente</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 ml-[52px]">
                                <select
                                    value={config.handoff_timeout_seconds || 0}
                                    onChange={e => setConfig({ ...config, handoff_timeout_seconds: Number(e.target.value) })}
                                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                                >
                                    <option value={0}>Desactivado (esperar indefinidamente)</option>
                                    <option value={60}>1 minuto</option>
                                    <option value={120}>2 minutos</option>
                                    <option value={180}>3 minutos</option>
                                    <option value={300}>5 minutos</option>
                                    <option value={600}>10 minutos</option>
                                    <option value={900}>15 minutos</option>
                                    <option value={1800}>30 minutos</option>
                                    <option value={3600}>1 hora</option>
                                </select>
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
                                                <div className="max-h-64 overflow-y-auto space-y-2 py-3 custom-scrollbar">
                                                    {messages.map((msg, i) => (
                                                        <div key={i} className={`flex ${msg.from_me ? "justify-end" : "justify-start"}`}>
                                                            <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs ${
                                                                msg.from_me
                                                                    ? "bg-purple-100 text-purple-800"
                                                                    : "bg-white text-gray-700 border border-gray-200"
                                                            }`}>
                                                                <p className="whitespace-pre-line">{msg.from_me ? msg.reply_text : msg.message_text}</p>
                                                                <p className="text-[10px] opacity-50 mt-1">{new Date(msg.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</p>
                                                            </div>
                                                        </div>
                                                    ))}
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
