"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Search, Plus, ExternalLink, Clock, MapPin, Phone, User, Bike, ChefHat, X, Check } from "lucide-react";
import dynamic from "next/dynamic";

const DynamicMap = dynamic(() => import("@/components/admin/PanelPedidosMap"), { ssr: false });

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
  created_at: string;
  pedido_items: PedidoItem[];
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
  { key: "preparando", label: "En preparación", color: "bg-orange-500", icon: ChefHat },
  { key: "listo", label: "Listos", color: "bg-green-500", icon: Bike },
];

const TIPO_BADGE: Record<string, { label: string; class: string }> = {
  delivery: { label: "Delivery", class: "bg-blue-100 text-blue-700" },
  takeaway: { label: "Take Away", class: "bg-purple-100 text-purple-700" },
  salon: { label: "Salón", class: "bg-amber-100 text-amber-700" },
};

export default function PanelPedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [filtro, setFiltro] = useState<"todos" | "delivery" | "takeaway">("todos");
  const [busqueda, setBusqueda] = useState("");
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    fetchPedidos();

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
      .in("estado", ["pendiente", "confirmado", "preparando", "listo"])
      .order("created_at", { ascending: false });
    setPedidos(data || []);
    setLoading(false);
  }

  async function cambiarEstado(pedido: Pedido, nuevoEstado: string) {
    await supabase.from("pedidos").update({ estado: nuevoEstado }).eq("id", pedido.id);
    fetchPedidos();
    if (selectedPedido?.id === pedido.id) {
      setSelectedPedido({ ...pedido, estado: nuevoEstado });
    }
  }

  const filtrados = pedidos.filter(p => {
    if (filtro !== "todos" && p.tipo !== filtro) return false;
    if (busqueda && !p.cliente_nombre?.toLowerCase().includes(busqueda.toLowerCase()) && !p.numero_pedido?.toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });

  function pedidosPorEstado(estadoKey: string) {
    return filtrados.filter(p => p.estado === estadoKey || (estadoKey === "pendiente" && p.estado === "confirmado"));
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
        <div className="px-6 py-4 flex items-center gap-4 flex-wrap border-b border-gray-100">
          <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white">
            {[
              { key: "todos", label: `Todos (${filtrados.length})` },
              { key: "delivery", label: "Delivery" },
              { key: "takeaway", label: "Take Away" },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setFiltro(opt.key as any)}
                className={`px-4 py-2 text-sm font-semibold transition-colors ${filtro === opt.key ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-white border border-gray-200 rounded-xl px-3 py-2 gap-2 flex-1 max-w-xs">
            <Search size={14} className="text-gray-400" />
            <input
              type="text"
              placeholder="Buscar"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="bg-transparent outline-none text-sm text-gray-900 w-full"
            />
          </div>

          <div className="ml-auto flex gap-2">
            <button className="flex items-center gap-1 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors">
              <Plus size={14} /> Nuevo pedido
            </button>
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="flex-1 flex overflow-hidden">
          {/* Columnas de Pedidos */}
          <div className="w-1/2 overflow-x-auto border-r border-gray-100">
            <div className="flex gap-3 p-4 min-w-[700px] h-full bg-slate-50">
              {ESTADOS.map(estado => {
                const pedidosCol = pedidosPorEstado(estado.key);
                return (
                  <div key={estado.key} className="flex-1 flex flex-col min-w-[220px]">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${estado.color}`} />
                        <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">{estado.label}</h3>
                      </div>
                      <span className="text-[10px] font-bold bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{pedidosCol.length}</span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pb-6">
                      {pedidosCol.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 text-sm italic">
                          No hay pedidos {estado.label.toLowerCase()}
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
                              className={`w-full text-left rounded-xl p-3 border transition-all hover:shadow-md ${selectedPedido?.id === pedido.id ? "border-purple-400 ring-2 ring-purple-100" : "border-gray-200"
                                } ${isLate ? "bg-red-500 text-white border-red-600" :
                                  isWarning ? "bg-orange-400 text-white border-orange-500" :
                                    "bg-white text-gray-900"
                                }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex flex-col">
                                  <span className={`text-[10px] font-black uppercase mb-0.5 ${isLate || isWarning ? "text-white/90" : "text-purple-600"}`}>
                                    ⏱ {elapsed} min
                                  </span>
                                  <span className={`text-[11px] font-bold ${isLate || isWarning ? "text-white" : "text-gray-900"}`}>{pedido.numero_pedido}</span>
                                </div>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isLate || isWarning ? "bg-white/20 text-white" : (TIPO_BADGE[pedido.tipo]?.class || "bg-gray-100 text-gray-600")
                                  }`}>
                                  {TIPO_BADGE[pedido.tipo]?.label || pedido.tipo}
                                </span>
                              </div>
                              <p className={`text-xs font-medium truncate ${isLate || isWarning ? "text-white/90" : "text-gray-800"}`}>{pedido.cliente_nombre || "Sin nombre"}</p>
                              <div className="flex items-center justify-between mt-1 pt-1 border-t border-black/5">
                                <span className={`text-[11px] font-bold ${isLate || isWarning ? "text-white" : "text-gray-900"}`}>$ {new Intl.NumberFormat("es-AR").format(pedido.total)}</span>
                                <span className={`text-[10px] ${isLate || isWarning ? "text-white/70" : "text-gray-400"}`}>{formatTime(pedido.created_at)}</span>
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
          <div className="hidden lg:block w-1/2 bg-slate-100 relative">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">{selectedPedido.numero_pedido}</h3>
                <span className="text-[10px] text-gray-400">{new Date(selectedPedido.created_at).toLocaleString()}</span>
              </div>
              <button onClick={() => setSelectedPedido(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cliente</h4>
                <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-900 font-bold">
                    <User size={14} className="text-purple-600" /> {selectedPedido.cliente_nombre || "—"}
                  </div>
                  {selectedPedido.cliente_telefono && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone size={14} className="text-gray-400" /> {selectedPedido.cliente_telefono}
                    </div>
                  )}
                  {selectedPedido.cliente_direccion && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin size={14} className="text-gray-400" /> {selectedPedido.cliente_direccion}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Productos</h4>
                <div className="space-y-2">
                  {selectedPedido.pedido_items?.map(item => (
                    <div key={item.id} className="flex justify-between text-sm border-b border-gray-50 pb-2">
                      <span className="text-gray-800"><span className="font-bold text-purple-600">{item.cantidad}x</span> {item.nombre_producto}</span>
                      <span className="text-gray-900 font-bold">$ {new Intl.NumberFormat("es-AR").format(item.precio_unitario * item.cantidad)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Subtotal</span>
                  <span>$ {new Intl.NumberFormat("es-AR").format(selectedPedido.subtotal)}</span>
                </div>
                {selectedPedido.costo_envio > 0 && (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Envío</span>
                    <span>$ {new Intl.NumberFormat("es-AR").format(selectedPedido.costo_envio)}</span>
                  </div>
                )}
                {selectedPedido.propina > 0 && (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Propina</span>
                    <span>$ {new Intl.NumberFormat("es-AR").format(selectedPedido.propina)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-gray-900 border-t border-gray-200 pt-2">
                  <span>Total</span>
                  <span>$ {new Intl.NumberFormat("es-AR").format(selectedPedido.total)}</span>
                </div>
                {selectedPedido.metodo_pago_nombre && (
                  <div className="text-[10px] text-purple-600 font-bold uppercase mt-1">Pago: {selectedPedido.metodo_pago_nombre}</div>
                )}
              </div>

              {selectedPedido.notas && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Notas</h4>
                  <p className="text-xs text-gray-600 italic bg-amber-50 rounded-lg p-3 border border-amber-100">{selectedPedido.notas}</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-gray-100 space-y-2">
              {selectedPedido.estado === "pendiente" && (
                <button onClick={() => cambiarEstado(selectedPedido, "preparando")} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl text-sm shadow-lg shadow-orange-200 transition-all">Pasar a preparación</button>
              )}
              {selectedPedido.estado === "preparando" && (
                <button onClick={() => cambiarEstado(selectedPedido, "listo")} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl text-sm shadow-lg shadow-green-200 transition-all">Marcar como listo</button>
              )}
              {selectedPedido.estado === "listo" && (
                <button onClick={() => cambiarEstado(selectedPedido, "entregado")} className="w-full bg-gray-900 hover:bg-black text-white font-bold py-3 rounded-xl text-sm transition-all">Marcar como entregado</button>
              )}
              <button onClick={() => cambiarEstado(selectedPedido, "cancelado")} className="w-full text-red-500 font-bold py-2 text-xs hover:underline transition-all">Cancelar pedido</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

