"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Search, Plus, Clock, MapPin, Phone, User, Bike, ChefHat, X, Check, Truck, ChevronDown } from "lucide-react";
import dynamic from "next/dynamic";
import ConfirmTimeModal from "@/components/admin/ConfirmTimeModal";
import { printComanda, printCocina } from "@/lib/printUtils";
import NuevoPedidoModal from "@/components/admin/NuevoPedidoModal";

const DynamicMap = dynamic(() => import("@/components/admin/PanelPedidosMap"), { ssr: false });

type PedidoItem = {
  id: string;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  notas?: string;
  adicionales?: { nombre: string; precio: number }[];
};

type Pedido = {
  id: string;
  numero_pedido: string;
  tipo: string;
  estado: string;
  cliente_nombre: string;
  cliente_telefono: string;
  cliente_direccion: string;
  cliente_lat: number | null;
  cliente_lng: number | null;
  total: number;
  subtotal: number;
  costo_envio: number;
  propina: number;
  metodo_pago_nombre: string;
  notas: string;
  origen: string;
  pedido_items: PedidoItem[];
  created_at: string;
  repartidor_id?: string | null;
};

const ESTADOS = [
  { key: "pendiente", label: "Nuevos", color: "bg-blue-500", icon: Clock },
  { key: "confirmado", label: "Confirmados", color: "bg-purple-500", icon: Check },
  { key: "preparando", label: "En preparación", color: "bg-orange-500", icon: ChefHat },
  { key: "listo", label: "Listos", color: "bg-green-500", icon: Bike },
  { key: "en_camino", label: "En camino", color: "bg-purple-600", icon: Truck },
];

const TIPO_BADGE: Record<string, { label: string; class: string }> = {
  delivery: { label: "Delivery", class: "bg-blue-100 text-blue-700" },
  takeaway: { label: "Take Away", class: "bg-purple-100 text-purple-700" },
  salon: { label: "Salón", class: "bg-amber-100 text-amber-700" },
};

const ESTADO_OPTIONS = [
  { key: "pendiente", label: "Pendiente" },
  { key: "confirmado", label: "Confirmado" },
  { key: "preparando", label: "Preparando" },
  { key: "listo", label: "Listo" },
  { key: "en_camino", label: "En camino" },
  { key: "entregado", label: "Entregado" },
  { key: "cancelado", label: "Cancelado" },
];

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR").format(n);
}

/* ── Bell sound (Web Audio API) ── */
function playBell() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.6, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.3);
  } catch (e) {
    // ignore if autoplay blocked
  }
}

export default function PanelPedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [repartidores, setRepartidores] = useState<any[]>([]);
  const [filtro, setFiltro] = useState<"todos" | "delivery" | "takeaway">("todos");
  const [busqueda, setBusqueda] = useState("");
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [modalTab, setModalTab] = useState<"detalle" | "repartidores">("detalle");
  const [confirmTimePedido, setConfirmTimePedido] = useState<Pedido | null>(null);
  const [isNuevoPedidoOpen, setIsNuevoPedidoOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [printConfig, setPrintConfig] = useState<any>(null);

  const knownIdsRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);

  useEffect(() => {
    fetchPedidos();
    fetchRepartidores();
    fetchPrintConfig();

    const timer = setInterval(() => setNow(new Date()), 60000);

    const channel = supabase
      .channel("pedidos-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, (payload) => {
        fetchPedidos(true);
      })
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, []);

  // When selectedPedido changes, reset to detalle tab
  useEffect(() => {
    if (selectedPedido) setModalTab("detalle");
  }, [selectedPedido?.id]);

  async function fetchPedidos(fromRealtime = false) {
    const { data } = await supabase
      .from("pedidos")
      .select("*, pedido_items(*)")
      .in("estado", ["pendiente", "confirmado", "preparando", "listo", "en_camino"])
      .order("created_at", { ascending: false });

    const rows = (data || []) as Pedido[];

    // Bell on new pedido
    if (fromRealtime && !firstLoadRef.current) {
      rows.forEach(p => {
        if (!knownIdsRef.current.has(p.id)) {
          playBell();
        }
      });
    }

    // Update known IDs
    knownIdsRef.current = new Set(rows.map(p => p.id));
    firstLoadRef.current = false;

    setPedidos(rows);
    setLoading(false);

    // Keep selectedPedido in sync
    setSelectedPedido(prev => {
      if (!prev) return null;
      const updated = rows.find(p => p.id === prev.id);
      return updated || prev;
    });
  }

  async function fetchRepartidores() {
    const { data } = await supabase.from("repartidores").select("*").eq("activo", true);
    setRepartidores(data || []);
  }

  async function fetchPrintConfig() {
    const { data } = await supabase.from("config_impresion").select("*").limit(1).maybeSingle();
    if (data) setPrintConfig(data);
  }

  async function cambiarEstado(pedido: Pedido, nuevoEstado: string) {
    await supabase.from("pedidos").update({ estado: nuevoEstado }).eq("id", pedido.id);
    fetchPedidos();
    if (selectedPedido?.id === pedido.id) {
      setSelectedPedido({ ...pedido, estado: nuevoEstado });
    }
  }

  async function asignarRepartidor(pedidoId: string, repartidorId: string) {
    await supabase.from("pedidos").update({ repartidor_id: repartidorId }).eq("id", pedidoId);
    fetchPedidos();
  }

  async function handleConfirmOrder(minutes: number) {
    if (!confirmTimePedido) return;
    await supabase.from("pedidos").update({
      estado: "confirmado",
      tiempo_preparacion_minutos: minutes
    }).eq("id", confirmTimePedido.id);
    setConfirmTimePedido(null);
    fetchPedidos();
  }

  const filtrados = pedidos.filter(p => {
    if (filtro !== "todos" && p.tipo !== filtro) return false;
    if (busqueda && !p.cliente_nombre?.toLowerCase().includes(busqueda.toLowerCase()) &&
      !p.numero_pedido?.toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });

  function pedidosPorEstado(key: string) {
    return filtrados.filter(p => p.estado === key);
  }

  function getElapsedMinutes(dateStr: string) {
    return Math.floor((now.getTime() - new Date(dateStr).getTime()) / 60000);
  }

  function formatHora(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  }

  function formatFechaCorta(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  const tipoLabel = (t: string) =>
    t === "delivery" ? "Delivery" : t === "takeaway" ? "Take Away" : "Salón";

  /* ─── RENDER ─── */
  return (
    <div className="flex h-full">
      {/* Main area */}
      <div className="flex-1 flex flex-col">
        {/* Top filters */}
        <div className="px-6 py-4 flex items-center gap-4 flex-wrap border-b border-gray-100 bg-white">
          <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">
            {[
              { key: "todos", label: `Todos (${filtrados.length})` },
              { key: "delivery", label: "Delivery" },
              { key: "takeaway", label: "Take Away" },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setFiltro(opt.key as any)}
                className={`px-4 py-2 text-sm font-semibold transition-colors ${filtro === opt.key ? "bg-[#7B1FA2] text-white" : "text-gray-500 hover:bg-gray-50"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 gap-2 flex-1 max-w-xs shadow-inner">
            <Search size={14} className="text-gray-400" />
            <input
              type="text"
              placeholder="Buscar pedido..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="bg-transparent outline-none text-sm text-gray-900 w-full"
            />
          </div>

          <div className="ml-auto">
            <button
              onClick={() => setIsNuevoPedidoOpen(true)}
              className="flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-800 transition-all shadow-md active:scale-95"
            >
              <Plus size={16} /> Nuevo pedido
            </button>
          </div>
        </div>

        {/* Kanban + Map */}
        <div className="flex-1 flex overflow-hidden">
          {/* Columnas */}
          <div className="w-1/2 overflow-x-auto border-r border-gray-100 bg-slate-50/50">
            <div className="flex gap-4 p-4 min-w-[1000px] h-full">
              {ESTADOS.map(estado => {
                const col = pedidosPorEstado(estado.key);
                return (
                  <div key={estado.key} className="flex-1 flex flex-col min-w-[200px]">
                    <div className="flex items-center justify-between mb-4 px-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${estado.color}`} />
                        <h3 className="font-bold text-gray-700 text-[11px] uppercase tracking-wider">{estado.label}</h3>
                      </div>
                      <span className="text-[10px] font-black bg-white border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full shadow-sm">{col.length}</span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pb-6">
                      {col.length === 0 ? (
                        <div className="text-center py-10 opacity-40">
                          <estado.icon size={24} className="mx-auto mb-2 text-gray-400" />
                          <p className="text-[11px] font-medium text-gray-500">Vacío</p>
                        </div>
                      ) : col.map(pedido => {
                        const elapsed = getElapsedMinutes(pedido.created_at);
                        const isLate = elapsed > 60;
                        const isWarning = elapsed > 40 && elapsed <= 60;
                        const numCorto = pedido.numero_pedido?.split("-")[1] ?? pedido.numero_pedido;
                        return (
                          <button
                            key={pedido.id}
                            onClick={() => setSelectedPedido(pedido)}
                            className={`w-full text-left rounded-2xl p-4 border transition-all hover:shadow-lg active:scale-[0.98] ${selectedPedido?.id === pedido.id ? "border-[#7B1FA2] ring-2 ring-[#7B1FA2]/10 bg-white" : "border-gray-200 bg-white shadow-sm"}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${isLate ? "bg-red-100 text-red-600" : isWarning ? "bg-orange-100 text-orange-600" : "bg-purple-50 text-[#7B1FA2]"}`}>
                                ⏱ {elapsed} min
                              </span>
                              <span className="text-[11px] font-black text-gray-900">#{numCorto}</span>
                            </div>
                            <p className="text-xs font-bold text-gray-900 mb-1 line-clamp-1">{pedido.cliente_nombre || "Sin nombre"}</p>
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                              <span className="text-[13px] font-black text-gray-900">$ {fmt(pedido.total)}</span>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${TIPO_BADGE[pedido.tipo]?.class || "bg-gray-100 text-gray-600"}`}>
                                {TIPO_BADGE[pedido.tipo]?.label || pedido.tipo}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mapa */}
          <div className="hidden lg:block w-1/2 bg-white relative">
            <DynamicMap
              pedidos={filtrados.filter(p => p.tipo === "delivery" && p.cliente_lat != null)}
              selectedPedidoId={selectedPedido?.id || null}
              onSelectPedido={(id) => {
                const found = pedidos.find(p => p.id === id);
                if (found) setSelectedPedido(found);
              }}
            />
          </div>
        </div>
      </div>

      {/* ── MODAL DETALLE PEDIDO (estilo Pedisy) ── */}
      {selectedPedido && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
          onClick={() => setSelectedPedido(null)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-800">
                {tipoLabel(selectedPedido.tipo)} Programado N°
                {selectedPedido.numero_pedido?.split("-")[1] ?? selectedPedido.numero_pedido}
              </h3>
              <button
                onClick={() => setSelectedPedido(null)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            {/* ── Body ── */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left panel */}
              <div className="flex-1 flex flex-col border-r border-gray-100 overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b border-gray-200">
                  {(["detalle", "repartidores"] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setModalTab(tab)}
                      className={`flex-1 py-3 text-xs font-semibold transition-colors ${modalTab === tab ? "border-b-2 border-[#7B1FA2] text-[#7B1FA2]" : "text-gray-500 hover:text-gray-700"}`}
                    >
                      {tab === "detalle" ? "Detalle del pedido" : "Repartidores"}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                  {modalTab === "detalle" && (
                    <div className="space-y-4">
                      {/* Tabla de productos */}
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-[10px] text-gray-400 uppercase font-semibold border-b border-gray-100">
                            <td className="pb-2">Producto</td>
                            <td className="pb-2 text-right">P. original</td>
                            <td className="pb-2 text-right">P. final</td>
                            <td className="pb-2 text-right">Total</td>
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedPedido.pedido_items ?? []).map(item => (
                            <tr key={item.id} className="border-b border-gray-50">
                              <td className="py-2 font-medium text-gray-800">
                                {item.cantidad} {item.nombre_producto}
                                {item.adicionales && item.adicionales.length > 0 && (
                                  <div className="text-[10px] text-gray-400 mt-0.5">
                                    {item.adicionales.map((a, i) => <span key={i} className="mr-2">+ {a.nombre}</span>)}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 text-right text-gray-500">$ {fmt(item.precio_unitario)}</td>
                              <td className="py-2 text-right text-gray-500">$ {fmt(item.precio_unitario)}</td>
                              <td className="py-2 text-right font-semibold">$ {fmt(item.precio_unitario * item.cantidad)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Subtotales */}
                      <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                        <div className="flex justify-between text-gray-700 font-semibold">
                          <span>Productos</span>
                          <span>$ {fmt(selectedPedido.subtotal)}</span>
                        </div>
                        {selectedPedido.costo_envio > 0 && (
                          <div className="flex justify-between text-gray-500">
                            <span>Envío</span>
                            <span>$ {fmt(selectedPedido.costo_envio)}</span>
                          </div>
                        )}
                        {selectedPedido.propina > 0 && (
                          <div className="flex justify-between text-gray-500">
                            <span>Propina</span>
                            <span>$ {fmt(selectedPedido.propina)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-gray-900 font-black text-base border-t border-gray-200 pt-2 mt-1">
                          <span>Total ({selectedPedido.metodo_pago_nombre || "Efectivo"})</span>
                          <span>$ {fmt(selectedPedido.total)}</span>
                        </div>
                      </div>

                      {/* Cancelar */}
                      <button
                        onClick={() => { cambiarEstado(selectedPedido, "cancelado"); setSelectedPedido(null); }}
                        className="text-red-500 text-xs font-semibold hover:underline"
                      >
                        Cancelar pedido
                      </button>
                    </div>
                  )}

                  {modalTab === "repartidores" && (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-500 mb-3">Asigná un repartidor a este pedido delivery.</p>
                      {repartidores.length === 0 ? (
                        <p className="text-gray-400 text-xs">No hay repartidores activos.</p>
                      ) : repartidores.map(r => (
                        <button
                          key={r.id}
                          onClick={() => asignarRepartidor(selectedPedido.id, r.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold transition-colors ${selectedPedido.repartidor_id === r.id ? "border-[#7B1FA2] bg-purple-50 text-[#7B1FA2]" : "border-gray-200 hover:border-[#7B1FA2]/50"}`}
                        >
                          <Bike size={16} />
                          {r.nombre}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right panel (info + acciones) */}
              <div className="w-64 flex flex-col p-5 gap-4 overflow-y-auto">
                {/* Estado selector */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">Estado</label>
                  <div className="relative">
                    <select
                      value={selectedPedido.estado}
                      onChange={e => cambiarEstado(selectedPedido, e.target.value)}
                      className="w-full appearance-none border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold bg-white outline-none focus:ring-2 focus:ring-[#7B1FA2]/30"
                    >
                      {ESTADO_OPTIONS.map(opt => (
                        <option key={opt.key} value={opt.key}>{opt.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Pedido # */}
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider mb-1">Pedido</p>
                  <p className="text-purple-600 font-semibold text-sm">#{selectedPedido.numero_pedido}</p>
                </div>

                {/* Cliente */}
                <div className="space-y-1.5">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">Cliente</p>
                  <div className="flex items-center gap-2">
                    <User size={13} className="text-gray-400 shrink-0" />
                    <span className="text-sm font-semibold text-gray-800">{selectedPedido.cliente_nombre || "Particular"}</span>
                  </div>
                  {selectedPedido.cliente_telefono && (
                    <div className="flex items-center gap-2">
                      <Phone size={13} className="text-gray-400 shrink-0" />
                      <a
                        href={`https://wa.me/${selectedPedido.cliente_telefono.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-purple-600 hover:underline"
                      >
                        {selectedPedido.cliente_telefono}
                      </a>
                    </div>
                  )}
                  {selectedPedido.cliente_direccion && (
                    <div className="flex items-start gap-2">
                      <MapPin size={13} className="text-gray-400 shrink-0 mt-0.5" />
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(selectedPedido.cliente_direccion)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-purple-600 hover:underline leading-tight"
                      >
                        {selectedPedido.cliente_direccion}
                      </a>
                    </div>
                  )}
                </div>

                {/* Pago */}
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider mb-1">Pago</p>
                  <p className="text-sm text-gray-700">{selectedPedido.metodo_pago_nombre || "Efectivo"}</p>
                </div>

                {/* Creado */}
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider mb-1">Creado</p>
                  <p className="text-xs text-gray-600">{formatFechaCorta(selectedPedido.created_at)} {formatHora(selectedPedido.created_at)} hs.</p>
                </div>

                {/* Botones de acción */}
                <div className="flex flex-col gap-2 mt-auto">
                  <div className="flex gap-2">
                    <button
                      onClick={() => printComanda(selectedPedido, printConfig)}
                      className="flex-1 bg-[#E8D5F5] hover:bg-[#d9c0f0] text-[#7B1FA2] py-2.5 rounded-xl text-xs font-bold transition-colors"
                    >
                      COMANDAR
                    </button>
                    <button
                      onClick={() => printCocina(selectedPedido, printConfig)}
                      className="flex-1 bg-[#E8D5F5] hover:bg-[#d9c0f0] text-[#7B1FA2] py-2.5 rounded-xl text-xs font-bold transition-colors"
                    >
                      COCINA
                    </button>
                  </div>

                  {/* Estado rápido (acción primaria) */}
                  {selectedPedido.estado === "pendiente" && (
                    <button
                      onClick={() => { setConfirmTimePedido(selectedPedido); setSelectedPedido(null); }}
                      className="w-full bg-gray-900 text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest hover:opacity-90 transition-all"
                    >
                      Confirmar
                    </button>
                  )}
                  {selectedPedido.estado === "confirmado" && (
                    <button onClick={() => cambiarEstado(selectedPedido, "preparando")} className="w-full bg-orange-500 text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest hover:opacity-90">En Cocina</button>
                  )}
                  {selectedPedido.estado === "preparando" && (
                    <button onClick={() => cambiarEstado(selectedPedido, "listo")} className="w-full bg-green-600 text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest hover:opacity-90">Marcar listo</button>
                  )}
                  {selectedPedido.estado === "listo" && (
                    <button onClick={() => cambiarEstado(selectedPedido, "en_camino")} className="w-full bg-[#7B1FA2] text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest hover:opacity-90">Despachar</button>
                  )}
                  {selectedPedido.estado === "en_camino" && (
                    <button onClick={() => { cambiarEstado(selectedPedido, "entregado"); setSelectedPedido(null); }} className="w-full bg-gray-900 text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest hover:opacity-90">Finalizar entrega</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmTimeModal
        isOpen={confirmTimePedido !== null}
        onClose={() => setConfirmTimePedido(null)}
        onConfirm={handleConfirmOrder}
        orderNumber={confirmTimePedido?.numero_pedido || ""}
      />

      <NuevoPedidoModal
        isOpen={isNuevoPedidoOpen}
        onClose={() => setIsNuevoPedidoOpen(false)}
        onCreated={() => { fetchPedidos(); setIsNuevoPedidoOpen(false); }}
      />
    </div>
  );
}
