"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Search, Plus, ExternalLink, Clock, MapPin, Phone, User, Bike, ChefHat, X, Check } from "lucide-react";

type Pedido = {
  id: string;
  numero_pedido: string;
  tipo: string;
  estado: string;
  cliente_nombre: string;
  cliente_telefono: string;
  cliente_direccion: string;
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

  useEffect(() => {
    fetchPedidos();

    // Supabase Realtime
    const channel = supabase
      .channel("pedidos-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => {
        fetchPedidos();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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

  return (
    <div className="flex h-full">
      {/* Main area */}
      <div className="flex-1 flex flex-col">
        {/* Top filters */}
        <div className="px-6 py-4 flex items-center gap-4 flex-wrap">
          {/* Type pills */}
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

          {/* Search */}
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
            <button className="text-sm text-purple-600 font-medium hover:underline">Otros pedidos</button>
            <button className="flex items-center gap-1 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors">
              <Plus size={14} /> Nuevo pedido
            </button>
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="flex-1 flex overflow-hidden">
          {/* Columnas de Pedidos (60%) */}
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-4 p-6 min-w-[900px] h-full">
              {ESTADOS.map(estado => {
                const pedidosCol = pedidosPorEstado(estado.key);
                return (
                  <div key={estado.key} className="flex-1 flex flex-col min-w-[280px]">
                    {/* Column header */}
                    <div className="flex items-center gap-2 mb-4">
                      <span className={`w-2 h-2 rounded-full ${estado.color}`} />
                      <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">
                        {pedidosCol.length} {estado.label}
                      </h3>
                    </div>

                    {/* Cards */}
                    <div className="flex-1 overflow-y-auto space-y-3 pb-6">
                      {pedidosCol.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 text-sm">
                          No hay pedidos {estado.label.toLowerCase()} {estado.key === "pendiente" ? "🍕" : estado.key === "preparando" ? "🍳" : "🛵"}
                        </div>
                      ) : (
                        pedidosCol.map(pedido => (
                          <button
                            key={pedido.id}
                            onClick={() => setSelectedPedido(pedido)}
                            className={`w-full text-left bg-white rounded-xl p-4 border transition-all hover:shadow-md ${selectedPedido?.id === pedido.id ? "border-purple-400 shadow-md" : "border-gray-200"
                              }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-gray-900">{pedido.numero_pedido}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TIPO_BADGE[pedido.tipo]?.class || "bg-gray-100 text-gray-600"}`}>
                                {TIPO_BADGE[pedido.tipo]?.label || pedido.tipo}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-gray-800 truncate">{pedido.cliente_nombre || "Sin nombre"}</p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-sm font-bold text-gray-900">$ {new Intl.NumberFormat("es-AR").format(pedido.total)}</span>
                              <span className="text-xs text-gray-400">{formatTime(pedido.created_at)}</span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mapa (40%) - Oculto en pantallas pequeñas */}
          <div className="hidden lg:block w-[400px] xl:w-[500px] border-l border-gray-100 bg-white relative">
            <div className="absolute inset-0 bg-slate-100 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center mb-4 text-purple-600">
                <MapPin size={32} />
              </div>
              <h4 className="font-bold text-gray-900 mb-1">Mapa de Pedidos</h4>
              <p className="text-sm text-gray-500">
                Visualizá la ubicación de tus pedidos de delivery en tiempo real.
              </p>
              <div className="mt-6 w-full max-w-[280px] aspect-video bg-gray-200 rounded-xl overflow-hidden border-4 border-white shadow-sm flex items-center justify-center grayscale opacity-50">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Google Maps Static View</span>
              </div>
              <button className="mt-8 text-xs font-bold text-purple-600 hover:text-purple-700 underline uppercase tracking-widest">
                Configurar API Key
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Detail drawer */}
      {selectedPedido && (
        <div className="w-96 bg-white border-l border-gray-200 flex flex-col overflow-hidden shrink-0">
          {/* Drawer header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900">{selectedPedido.numero_pedido}</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TIPO_BADGE[selectedPedido.tipo]?.class || "bg-gray-100"}`}>
                {TIPO_BADGE[selectedPedido.tipo]?.label || selectedPedido.tipo}
              </span>
            </div>
            <button onClick={() => setSelectedPedido(null)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          {/* Drawer body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Client info */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Cliente</h4>
              <div className="flex items-center gap-2 text-sm text-gray-900">
                <User size={14} className="text-gray-400" />
                {selectedPedido.cliente_nombre || "—"}
              </div>
              {selectedPedido.cliente_telefono && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone size={14} className="text-gray-400" />
                  {selectedPedido.cliente_telefono}
                </div>
              )}
              {selectedPedido.cliente_direccion && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin size={14} className="text-gray-400" />
                  {selectedPedido.cliente_direccion}
                </div>
              )}
            </div>

            {/* Items */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Productos</h4>
              {selectedPedido.pedido_items?.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-800">
                    <span className="font-bold">{item.cantidad}x</span> {item.nombre_producto}
                  </span>
                  <span className="text-gray-600 font-medium">
                    $ {new Intl.NumberFormat("es-AR").format(item.precio_unitario * item.cantidad)}
                  </span>
                </div>
              ))}
            </div>

            {/* Payment / totals */}
            <div className="space-y-2 border-t border-gray-100 pt-3">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>$ {new Intl.NumberFormat("es-AR").format(selectedPedido.subtotal)}</span>
              </div>
              {selectedPedido.costo_envio > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Envío</span>
                  <span>$ {new Intl.NumberFormat("es-AR").format(selectedPedido.costo_envio)}</span>
                </div>
              )}
              {selectedPedido.propina > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Propina</span>
                  <span>$ {new Intl.NumberFormat("es-AR").format(selectedPedido.propina)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-gray-900 border-t border-gray-100 pt-2">
                <span>Total</span>
                <span>$ {new Intl.NumberFormat("es-AR").format(selectedPedido.total)}</span>
              </div>
              {selectedPedido.metodo_pago_nombre && (
                <div className="text-xs text-gray-500">Pago: {selectedPedido.metodo_pago_nombre}</div>
              )}
            </div>

            {/* Notas */}
            {selectedPedido.notas && (
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Notas</h4>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{selectedPedido.notas}</p>
              </div>
            )}
          </div>

          {/* Drawer footer: state change buttons */}
          <div className="p-4 border-t border-gray-100 space-y-2">
            {selectedPedido.estado === "pendiente" && (
              <button
                onClick={() => cambiarEstado(selectedPedido, "preparando")}
                className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold py-3 rounded-xl text-sm transition-colors"
              >
                Pasar a preparación
              </button>
            )}
            {selectedPedido.estado === "preparando" && (
              <button
                onClick={() => cambiarEstado(selectedPedido, "listo")}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl text-sm transition-colors"
              >
                Marcar como listo
              </button>
            )}
            {selectedPedido.estado === "listo" && (
              <button
                onClick={() => cambiarEstado(selectedPedido, "entregado")}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 rounded-xl text-sm transition-colors"
              >
                Marcar como entregado
              </button>
            )}
            <button
              onClick={() => cambiarEstado(selectedPedido, "cancelado")}
              className="w-full border border-red-200 text-red-600 font-medium py-2.5 rounded-xl text-sm hover:bg-red-50 transition-colors"
            >
              Cancelar pedido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
