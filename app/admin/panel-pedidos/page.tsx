"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Search, Plus, ExternalLink, Clock, MapPin, Phone, User, Bike, ChefHat, X, Check, Truck, CreditCard } from "lucide-react";
import dynamic from "next/dynamic";

const DynamicMap = dynamic(() => import("@/components/admin/PanelPedidosMap"), { ssr: false });
import ConfirmTimeModal from "@/components/admin/ConfirmTimeModal";
import { printOrderTicket } from "@/lib/printUtils";
import NuevoPedidoModal from "@/components/admin/NuevoPedidoModal";

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

type PedidoItem = {
  id: string;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  notas: string;
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

export default function PanelPedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [repartidores, setRepartidores] = useState<any[]>([]);
  const [filtro, setFiltro] = useState<"todos" | "delivery" | "takeaway">("todos");
  const [busqueda, setBusqueda] = useState("");
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [confirmTimePedido, setConfirmTimePedido] = useState<Pedido | null>(null);
  const [isNuevoPedidoOpen, setIsNuevoPedidoOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    fetchPedidos();
    fetchRepartidores();

    // Actualizar cada minuto para el contador de tiempo transcurrido
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000);

    // Supabase Realtime
    const channel = supabase
      .channel("pedidos-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => {
        fetchPedidos();
      })
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchPedidos() {
    const { data } = await supabase
      .from("pedidos")
      .select("*, pedido_items(*)")
      .in("estado", ["pendiente", "confirmado", "preparando", "listo", "en_camino"])
      .order("created_at", { ascending: false });
    setPedidos(data || []);
    setLoading(false);
  }

  async function fetchRepartidores() {
    const { data } = await supabase.from("repartidores").select("*").eq("activo", true);
    setRepartidores(data || []);
  }

  async function cambiarEstado(pedido: Pedido, nuevoEstado: string) {
    const updateData: any = { estado: nuevoEstado };

    // Si pasa a en_camino, podríamos querer registrar algo más aquí

    await supabase.from("pedidos").update(updateData).eq("id", pedido.id);
    fetchPedidos();
    if (selectedPedido?.id === pedido.id) {
      setSelectedPedido({ ...pedido, estado: nuevoEstado });
    }
  }

  async function asignarRepartidor(pedidoId: string, repartidorId: string) {
    await supabase.from("pedidos").update({ repartidor_id: repartidorId }).eq("id", pedidoId);
    fetchPedidos();
    if (selectedPedido?.id === pedidoId) {
      setSelectedPedido({ ...selectedPedido, repartidor_id: repartidorId } as Pedido);
    }
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
    if (busqueda && !p.cliente_nombre?.toLowerCase().includes(busqueda.toLowerCase()) && !p.numero_pedido?.toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });

  function pedidosPorEstado(estadoKey: string) {
    return filtrados.filter(p => p.estado === estadoKey);
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  }

  function getElapsedMinutes(dateStr: string) {
    const start = new Date(dateStr);
    const diffMs = now.getTime() - start.getTime();
    return Math.floor(diffMs / 60000);
  }

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

          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setIsNuevoPedidoOpen(true)}
              className="flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-800 transition-all shadow-md active:scale-95"
            >
              <Plus size={16} /> Nuevo pedido
            </button>
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="flex-1 flex overflow-hidden">
          {/* Columnas de Pedidos */}
          <div className="w-1/2 overflow-x-auto border-r border-gray-100 bg-slate-50/50">
            <div className="flex gap-4 p-4 min-w-[1000px] h-full">
              {ESTADOS.map(estado => {
                const pedidosCol = pedidosPorEstado(estado.key);
                return (
                  <div key={estado.key} className="flex-1 flex flex-col min-w-[200px]">
                    <div className="flex items-center justify-between mb-4 px-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${estado.color}`} />
                        <h3 className="font-bold text-gray-700 text-[11px] uppercase tracking-wider">{estado.label}</h3>
                      </div>
                      <span className="text-[10px] font-black bg-white border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full shadow-sm">{pedidosCol.length}</span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pb-6 custom-scrollbar">
                      {pedidosCol.length === 0 ? (
                        <div className="text-center py-10 opacity-40">
                          <estado.icon size={24} className="mx-auto mb-2 text-gray-400" />
                          <p className="text-[11px] font-medium text-gray-500">Vacío</p>
                        </div>
                      ) : (
                        pedidosCol.map(pedido => {
                          const elapsed = getElapsedMinutes(pedido.created_at);
                          const isLate = elapsed > 60;
                          const isWarning = elapsed > 40 && elapsed <= 60;

                          return (
                            <button
                              key={pedido.id}
                              onClick={() => setSelectedPedido(pedido)}
                              className={`w-full text-left rounded-2xl p-4 border transition-all hover:shadow-lg active:scale-[0.98] ${selectedPedido?.id === pedido.id ? "border-[#7B1FA2] ring-2 ring-[#7B1FA2]/10 bg-white" : "border-gray-200 bg-white shadow-sm"
                                }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${isLate ? "bg-red-100 text-red-600" :
                                  isWarning ? "bg-orange-100 text-orange-600" :
                                    "bg-purple-50 text-[#7B1FA2]"
                                  }`}>
                                  ⏱ {elapsed} min
                                </span>
                                <span className="text-[11px] font-black text-gray-900">#{pedido.numero_pedido.split('-')[1]}</span>
                              </div>
                              <p className="text-xs font-bold text-gray-900 mb-1 line-clamp-1">{pedido.cliente_nombre || "Sin nombre"}</p>
                              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                                <span className="text-[13px] font-black text-gray-900">$ {new Intl.NumberFormat("es-AR").format(pedido.total)}</span>
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${TIPO_BADGE[pedido.tipo]?.class || "bg-gray-100 text-gray-600"}`}>
                                  {TIPO_BADGE[pedido.tipo]?.label || pedido.tipo}
                                </span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mapa Area */}
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

      {/* Detail Modal */}
      {selectedPedido && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[92vh] border border-gray-100">
            <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between bg-white">
              <div>
                <h3 className="text-lg font-black text-gray-900">{selectedPedido.numero_pedido}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{new Date(selectedPedido.created_at).toLocaleDateString()}</span>
                  <span className="w-1 h-1 rounded-full bg-gray-300" />
                  <span className="text-[10px] font-bold text-[#7B1FA2] uppercase tracking-widest">{selectedPedido.estado}</span>
                </div>
              </div>
              <button onClick={() => setSelectedPedido(null)} className="bg-gray-50 text-gray-400 hover:text-gray-600 p-2 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {/* Acciones Rápidas */}
              <div className="flex gap-2">
                <button
                  onClick={() => printOrderTicket(selectedPedido)}
                  className="flex-1 bg-[#7B1FA2] text-white py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-[#7B1FA2]/20 hover:opacity-90 transition-all font-inter"
                >
                  COMANDAR
                </button>
                <button className="flex-1 bg-white border border-gray-200 text-gray-700 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all">
                  FACTURAR
                </button>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Detalles del Cliente</h4>
                <div className="bg-gray-50/50 rounded-3xl p-5 space-y-4 border border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center text-[#7B1FA2]">
                      <User size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-900">{selectedPedido.cliente_nombre || "Particular"}</p>
                      <p className="text-[11px] font-bold text-gray-400">{selectedPedido.cliente_telefono || "Sin teléfono"}</p>
                    </div>
                  </div>
                  {selectedPedido.cliente_direccion && (
                    <div className="flex items-start gap-4 pt-4 border-t border-gray-100">
                      <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center text-orange-500">
                        <MapPin size={18} />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Dirección</p>
                        <p className="text-xs font-black text-gray-700 leading-relaxed">{selectedPedido.cliente_direccion}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Productos</h4>
                  <span className="text-[10px] font-bold bg-purple-50 text-[#7B1FA2] px-2 py-0.5 rounded-full">{selectedPedido.pedido_items?.length} Ítems</span>
                </div>
                <div className="space-y-3">
                  {selectedPedido.pedido_items?.map(item => (
                    <div key={item.id} className="flex justify-between items-center group">
                      <div className="flex gap-3 items-center">
                        <span className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] font-black text-gray-500">{item.cantidad}</span>
                        <span className="text-xs font-bold text-gray-700 group-hover:text-[#7B1FA2] transition-colors">{item.nombre_producto}</span>
                      </div>
                      <span className="text-xs font-black text-gray-900">$ {new Intl.NumberFormat("es-AR").format(item.precio_unitario * item.cantidad)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Repartidores (Solo si es delivery y está listo o en camino) */}
              {(selectedPedido.tipo === "delivery") && (
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Asignación de Reparto</h4>
                  <div className="relative">
                    <select
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-3.5 text-xs font-bold text-gray-700 appearance-none outline-none focus:ring-2 focus:ring-[#7B1FA2]/50"
                      value={selectedPedido.repartidor_id || ""}
                      onChange={(e) => asignarRepartidor(selectedPedido.id, e.target.value)}
                    >
                      <option value="">Seleccionar Repartidor...</option>
                      {repartidores.map(r => (
                        <option key={r.id} value={r.id}>{r.nombre}</option>
                      ))}
                    </select>
                    <Bike size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              )}

              <div className="bg-gray-900 rounded-[2rem] p-6 space-y-3 shadow-xl">
                <div className="flex justify-between text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                  <span>Productos</span>
                  <span>$ {new Intl.NumberFormat("es-AR").format(selectedPedido.subtotal)}</span>
                </div>
                {selectedPedido.costo_envio > 0 && (
                  <div className="flex justify-between text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                    <span>Envío</span>
                    <span>$ {new Intl.NumberFormat("es-AR").format(selectedPedido.costo_envio)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-black text-white border-t border-white/10 pt-4 mt-2">
                  <span>TOTAL</span>
                  <span>$ {new Intl.NumberFormat("es-AR").format(selectedPedido.total)}</span>
                </div>
                {selectedPedido.metodo_pago_nombre && (
                  <div className="flex items-center gap-2 text-[10px] font-black text-[#7B1FA2] uppercase tracking-[0.2em] mt-2">
                    <CreditCard size={12} />
                    {selectedPedido.metodo_pago_nombre}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-gray-50/50 border-t border-gray-50 flex gap-3">
              {selectedPedido.estado === "pendiente" && (
                <button
                  onClick={() => {
                    setConfirmTimePedido(selectedPedido);
                    setSelectedPedido(null);
                  }}
                  className="flex-1 bg-black text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest shadow-lg hover:opacity-90 transition-all"
                >
                  Confirmar Pedido
                </button>
              )}
              {selectedPedido.estado === "confirmado" && (
                <button onClick={() => cambiarEstado(selectedPedido, "preparando")} className="flex-1 bg-orange-500 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest shadow-lg hover:opacity-90 transition-all">En Cocina</button>
              )}
              {selectedPedido.estado === "preparando" && (
                <button onClick={() => cambiarEstado(selectedPedido, "listo")} className="flex-1 bg-green-600 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest shadow-lg hover:opacity-90 transition-all">Marcar como Listo</button>
              )}
              {selectedPedido.estado === "listo" && (
                <button onClick={() => cambiarEstado(selectedPedido, "en_camino")} className="flex-1 bg-[#7B1FA2] text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest shadow-lg hover:opacity-90 transition-all">Despachar Pedido</button>
              )}
              {selectedPedido.estado === "en_camino" && (
                <button onClick={() => cambiarEstado(selectedPedido, "entregado")} className="flex-1 bg-gray-900 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest shadow-lg hover:opacity-90 transition-all">Finalizar Entrega</button>
              )}
              <button onClick={() => cambiarEstado(selectedPedido, "cancelado")} className="bg-white border border-gray-200 text-red-500 p-4 rounded-2xl hover:bg-red-50 transition-all">
                <X size={18} />
              </button>
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
        onCreated={() => {
          fetchPedidos();
          setIsNuevoPedidoOpen(false);
        }}
      />
    </div>
  );
}

