"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useParams } from "next/navigation";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/components/admin/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { 
  Headphones, 
  MessageSquare, 
  Send, 
  CheckCircle, 
  AlertCircle, 
  Bell, 
  BellOff, 
  Loader2, 
  Building2, 
  Clock 
} from "lucide-react";

interface Ticket {
  id: string;
  titulo: string;
  estado: string;
  created_at: string;
  sucursal_id: string;
  sucursal_nombre?: string;
  usuarios?: {
    nombre: string | null;
    email: string;
  } | null;
}

interface Message {
  id: string;
  ticket_id: string;
  usuario_id: string;
  mensaje: string;
  created_at: string;
  usuarios?: {
    nombre: string | null;
    email: string;
    rol: string;
  } | null;
}

function SoporteContent() {
  const { user } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  const tenantSlug = params?.tenant as string;

  // Notificaciones Push Hook
  const { 
    isSubscribed, 
    loading: pushLoading, 
    error: pushError, 
    subscribe, 
    unsubscribe, 
    supported 
  } = usePushNotifications();

  // Estados locales
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [newTicketTitle, setNewTicketTitle] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sucursalData, setSucursalData] = useState<{ id: string; nombre: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Cargar datos de la sucursal actual (si no es super_admin)
  useEffect(() => {
    async function fetchSucursal() {
      if (user?.rol === "super_admin") return;
      
      const { data, error } = await supabase
        .from("sucursales")
        .select("id, nombre")
        .eq("slug", tenantSlug)
        .single();

      if (!error && data) {
        setSucursalData(data);
      }
    }

    if (user && tenantSlug) {
      fetchSucursal();
    }
  }, [user, tenantSlug]);

  // Cargar tickets
  useEffect(() => {
    async function fetchTickets() {
      if (!user) return;
      setLoadingTickets(true);
      setError(null);

      try {
        let query = supabase
          .from("support_tickets")
          .select(`
            id, 
            titulo, 
            estado, 
            created_at, 
            sucursal_id,
            usuarios (nombre, email)
          `)
          .order("updated_at", { ascending: false });

        // Si no es superadmin, filtrar por su sucursal
        if (user.rol !== "super_admin" && sucursalData?.id) {
          query = query.eq("sucursal_id", sucursalData.id);
        }

        const { data, error: dbErr } = await query;

        if (dbErr) throw dbErr;

        // Formatear tickets para resolver que usuarios puede venir como objeto o array
        const formattedTickets = ((data as any[]) || []).map((t) => {
          const userObj = Array.isArray(t.usuarios) ? t.usuarios[0] : t.usuarios;
          return {
            id: t.id,
            titulo: t.titulo,
            estado: t.estado,
            created_at: t.created_at,
            sucursal_id: t.sucursal_id,
            usuarios: userObj ? { nombre: userObj.nombre, email: userObj.email } : null
          } as Ticket;
        });

        // Si es superadmin, resolvemos nombres de sucursales para cada ticket
        if (user.rol === "super_admin" && formattedTickets.length > 0) {
          const { data: sucs } = await supabase
            .from("sucursales")
            .select("id, nombre");

          const mappedTickets = formattedTickets.map((t) => {
            const suc = sucs?.find((s) => s.id === t.sucursal_id);
            return {
              ...t,
              sucursal_nombre: suc ? suc.nombre : "Sucursal Desconocida",
            };
          });
          setTickets(mappedTickets);
        } else {
          setTickets(formattedTickets);
        }
      } catch (err: any) {
        console.error("Error cargando tickets:", err);
        setError("Error al cargar los tickets de soporte.");
      } finally {
        setLoadingTickets(false);
      }
    }

    if (user && (user.rol === "super_admin" || sucursalData?.id)) {
      fetchTickets();
    }
  }, [user, sucursalData]);

  // Manejar query param ?ticket=ID
  useEffect(() => {
    const ticketId = searchParams.get("ticket");
    if (ticketId && tickets.length > 0) {
      const found = tickets.find((t) => t.id === ticketId);
      if (found) {
        setActiveTicket(found);
      }
    }
  }, [searchParams, tickets]);

  // Cargar mensajes de un ticket activo
  useEffect(() => {
    async function fetchMessages() {
      if (!activeTicket) return;
      setLoadingMessages(true);

      try {
        const { data, error: dbErr } = await supabase
          .from("support_messages")
          .select(`
            id,
            ticket_id,
            usuario_id,
            mensaje,
            created_at,
            usuarios (nombre, email, rol)
          `)
          .eq("ticket_id", activeTicket.id)
          .order("created_at", { ascending: true });

        if (dbErr) throw dbErr;

        const formattedMsgs = ((data as any[]) || []).map((m) => {
          const userObj = Array.isArray(m.usuarios) ? m.usuarios[0] : m.usuarios;
          return {
            id: m.id,
            ticket_id: m.ticket_id,
            usuario_id: m.usuario_id,
            mensaje: m.mensaje,
            created_at: m.created_at,
            usuarios: userObj ? { nombre: userObj.nombre, email: userObj.email, rol: userObj.rol } : null
          } as Message;
        });
        setMessages(formattedMsgs);
      } catch (err) {
        console.error("Error cargando mensajes:", err);
      } finally {
        setLoadingMessages(false);
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    }

    fetchMessages();

    // Suscribirse a mensajes nuevos en tiempo real
    const channel = supabase
      .channel(`support_messages_ticket_${activeTicket?.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${activeTicket?.id}`,
        },
        async (payload) => {
          // Obtener datos del usuario autor para el nuevo mensaje
          const { data: userAuthor } = await supabase
            .from("usuarios")
            .select("nombre, email, rol")
            .eq("id", payload.new.usuario_id)
            .single();

          const newMsg: Message = {
            id: payload.new.id,
            ticket_id: payload.new.ticket_id,
            usuario_id: payload.new.usuario_id,
            mensaje: payload.new.mensaje,
            created_at: payload.new.created_at,
            usuarios: userAuthor,
          };

          setMessages((prev) => [...prev, newMsg]);
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
          }, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTicket]);

  // Crear ticket nuevo (tenants)
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketTitle.trim() || !user || !sucursalData) return;

    try {
      const { data, error: dbErr } = await supabase
        .from("support_tickets")
        .insert({
          titulo: newTicketTitle,
          sucursal_id: sucursalData.id,
          usuario_id: user.id,
          estado: "abierto",
        })
        .select()
        .single();

      if (dbErr) throw dbErr;

      const newTicket: Ticket = {
        ...data,
        usuarios: { nombre: user.nombre || null, email: user.email },
      };

      setTickets((prev) => [newTicket, ...prev]);
      setActiveTicket(newTicket);
      setNewTicketTitle("");
      setShowCreateModal(false);
    } catch (err) {
      console.error("Error al crear ticket:", err);
      alert("No se pudo crear el ticket de soporte.");
    }
  };

  // Enviar mensaje
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeTicket || !user) return;

    const text = newMessage;
    setNewMessage("");

    try {
      const { error: dbErr } = await supabase.from("support_messages").insert({
        ticket_id: activeTicket.id,
        usuario_id: user.id,
        mensaje: text,
      });

      if (dbErr) throw dbErr;

      // Disparar Webhook de notificaciones push
      const isSenderSuperAdmin = user.rol === "super_admin";
      
      if (!isSenderSuperAdmin) {
        fetch("/api/support/notify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-support-webhook-secret": "webhook_secret_support_9988776655"
          },
          body: JSON.stringify({
            ticketId: activeTicket.id,
            mensaje: text,
            usuarioId: user.id,
            sucursalNombre: sucursalData?.nombre || "Sucursal"
          })
        }).catch(err => console.error("Error gatillando push notification:", err));
      }

    } catch (err) {
      console.error("Error al enviar mensaje:", err);
      alert("No se pudo enviar el mensaje.");
    }
  };

  // Cerrar/Reabrir ticket
  const handleToggleTicketStatus = async (ticket: Ticket) => {
    const nuevoEstado = ticket.estado === "abierto" ? "cerrado" : "abierto";
    try {
      const { error: dbErr } = await supabase
        .from("support_tickets")
        .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
        .eq("id", ticket.id);

      if (dbErr) throw dbErr;

      setTickets((prev) =>
        prev.map((t) => (t.id === ticket.id ? { ...t, estado: nuevoEstado } : t))
      );
      if (activeTicket?.id === ticket.id) {
        setActiveTicket((prev) => prev ? { ...prev, estado: nuevoEstado } : null);
      }
    } catch (err) {
      console.error("Error actualizando estado del ticket:", err);
    }
  };

  const isSuperAdmin = user?.rol === "super_admin";

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-50 overflow-hidden">
      {/* Push Settings Panel (Only for super_admin) */}
      {isSuperAdmin && (
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isSubscribed ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
              {isSubscribed ? <Bell className="w-5 h-5 animate-bounce" /> : <BellOff className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">
                Notificaciones Push de Soporte
              </h3>
              <p className="text-xs text-gray-500">
                {isSubscribed 
                  ? "Notificaciones activas. Recibirás avisos en tiempo real." 
                  : "Activa las notificaciones para recibir alertas de tickets nuevos."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {pushLoading ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin text-[#7B1FA2]" />
                Procesando...
              </div>
            ) : pushError ? (
              <div className="flex items-center gap-1.5 text-xs text-red-600 font-bold bg-red-50 px-3 py-1.5 rounded-xl border border-red-100">
                <AlertCircle className="w-4 h-4" />
                {pushError}
              </div>
            ) : null}

            {!supported ? (
              <span className="text-[10px] font-black uppercase bg-orange-100 text-orange-700 border border-orange-200 px-3 py-1.5 rounded-xl">
                Push No Soportado
              </span>
            ) : isSubscribed ? (
              <button
                onClick={unsubscribe}
                className="bg-white hover:bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2"
              >
                Desactivar Notificaciones
              </button>
            ) : (
              <button
                onClick={subscribe}
                className="bg-[#7B1FA2] hover:bg-[#6A1B9A] text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-200 flex items-center gap-2 active:scale-95 cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                Activar Notificaciones
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Support Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Ticket List */}
        <div className="w-80 border-r border-gray-200 bg-white flex flex-col shrink-0 h-full overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between shrink-0">
            <h2 className="text-sm font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
              <Headphones size={18} className="text-[#7B1FA2]" />
              Tickets de Soporte
            </h2>
            {!isSuperAdmin && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="text-xs bg-[#7B1FA2] hover:bg-[#6A1B9A] text-white font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95"
              >
                Nuevo
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {loadingTickets ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-[#7B1FA2]" />
                <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Cargando...</span>
              </div>
            ) : tickets.length === 0 ? (
              <div className="py-20 text-center text-gray-400 text-xs font-bold px-6 uppercase tracking-wider">
                No hay tickets creados
              </div>
            ) : (
              tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTicket(t)}
                  className={`w-full text-left p-4 hover:bg-gray-50 transition-all flex flex-col gap-1.5 relative border-l-4 ${
                    activeTicket?.id === t.id 
                      ? "bg-purple-50/40 border-[#7B1FA2]" 
                      : "border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                      t.estado === "abierto" 
                        ? "bg-green-100 text-green-700 border border-green-200" 
                        : "bg-gray-100 text-gray-500 border border-gray-200"
                    }`}>
                      {t.estado}
                    </span>
                    <span className="text-[10px] text-gray-400 font-semibold">
                      {new Date(t.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-800 text-sm line-clamp-1 group-hover:text-[#7B1FA2]">
                    {t.titulo}
                  </h3>
                  {isSuperAdmin && (
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Building2 size={10} className="text-purple-400" />
                      {t.sucursal_nombre}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Chat Message Area */}
        <div className="flex-1 flex flex-col bg-gray-50 h-full overflow-hidden">
          {activeTicket ? (
            <>
              {/* Ticket Topbar info */}
              <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0 shadow-sm">
                <div>
                  <h3 className="font-extrabold text-gray-800 text-base flex items-center gap-2">
                    {activeTicket.titulo}
                  </h3>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                      activeTicket.estado === "abierto" 
                        ? "bg-green-100 text-green-700 border border-green-200" 
                        : "bg-gray-100 text-gray-500 border border-gray-200"
                    }`}>
                      {activeTicket.estado}
                    </span>
                    {isSuperAdmin && (
                      <span className="font-bold flex items-center gap-1">
                        <Building2 size={12} className="text-gray-400" />
                        {activeTicket.sucursal_nombre}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock size={12} className="text-gray-400" />
                      Creado el {new Date(activeTicket.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Cerrar / Reabrir Ticket */}
                <button
                  onClick={() => handleToggleTicketStatus(activeTicket)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                    activeTicket.estado === "abierto"
                      ? "bg-white hover:bg-gray-50 text-gray-700 border-gray-300"
                      : "bg-[#7B1FA2] hover:bg-[#6A1B9A] text-white border-transparent"
                  }`}
                >
                  {activeTicket.estado === "abierto" ? "Cerrar Ticket" : "Reabrir Ticket"}
                </button>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {loadingMessages ? (
                  <div className="py-20 flex justify-center items-center">
                    <Loader2 className="w-8 h-8 animate-spin text-[#7B1FA2]" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-20 text-center text-gray-400 font-bold uppercase tracking-wider text-xs">
                    Comienza el chat enviando un mensaje
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMsgFromSuperAdmin = m.usuarios?.rol === "super_admin";
                    const isOwnMessage = m.usuario_id === user?.id;

                    return (
                      <div
                        key={m.id}
                        className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-md p-4 rounded-3xl shadow-sm border ${
                            isOwnMessage
                              ? "bg-[#7B1FA2] text-white border-transparent rounded-tr-none"
                              : isMsgFromSuperAdmin
                                ? "bg-purple-100 text-purple-900 border-purple-200 rounded-tl-none"
                                : "bg-white text-gray-800 border-gray-200 rounded-tl-none"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-6 mb-1 text-[9px] font-black uppercase tracking-wider opacity-70">
                            <span>{m.usuarios?.nombre || m.usuarios?.email || "Usuario"}</span>
                            <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.mensaje}</p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <div className="bg-white border-t border-gray-200 p-4 shrink-0 shadow-inner">
                {activeTicket.estado === "cerrado" ? (
                  <div className="bg-gray-100 text-gray-500 py-3 px-4 rounded-2xl text-xs font-bold text-center border border-gray-200">
                    Este ticket está cerrado. Reábrelo para poder enviar mensajes.
                  </div>
                ) : (
                  <form onSubmit={handleSendMessage} className="flex gap-3">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Escribe tu mensaje aquí..."
                      className="flex-1 bg-gray-50 border border-gray-300 rounded-2xl px-5 py-3.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-[#7B1FA2] placeholder:text-gray-400"
                    />
                    <button
                      type="submit"
                      className="bg-[#7B1FA2] hover:bg-[#6A1B9A] text-white px-5 rounded-2xl transition-all shadow-md hover:shadow-purple-200 flex items-center justify-center active:scale-95 cursor-pointer"
                    >
                      <Send size={18} />
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-6">
              <MessageSquare size={48} className="text-gray-300 mb-4" />
              <p className="font-extrabold text-sm uppercase tracking-widest text-center">
                Selecciona un ticket para ver la conversación
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Ticket Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-250">
          <div className="bg-white rounded-[2rem] p-8 max-w-md w-full border border-gray-200 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-gray-900 uppercase tracking-wider mb-6 flex items-center gap-2">
              <Headphones className="text-[#7B1FA2]" />
              Nuevo Ticket de Soporte
            </h3>
            <form onSubmit={handleCreateTicket} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2 ml-1">
                  Título / Asunto
                </label>
                <input
                  type="text"
                  required
                  value={newTicketTitle}
                  onChange={(e) => setNewTicketTitle(e.target.value)}
                  placeholder="Ej: Problemas con la impresora de comandas"
                  className="w-full bg-gray-50 border border-gray-300 rounded-2xl px-5 py-4 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-purple-100 focus:border-[#7B1FA2]"
                />
              </div>
              <div className="flex gap-4 justify-end pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewTicketTitle("");
                  }}
                  className="px-6 py-3 text-xs font-bold text-gray-500 hover:text-gray-950 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#7B1FA2] hover:bg-[#6A1B9A] text-white px-8 py-3 text-xs font-black rounded-xl uppercase tracking-widest transition-all active:scale-95 shadow-md shadow-purple-100"
                >
                  Crear Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SoportePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#7B1FA2]" />
      </div>
    }>
      <SoporteContent />
    </Suspense>
  );
}
