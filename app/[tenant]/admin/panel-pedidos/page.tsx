"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Search, Plus, Clock, MapPin, Phone, User, Bike, ChefHat, X, Check, Truck, ChevronDown, Settings as SettingsIcon, Pencil, Trash2, ExternalLink, QrCode } from "lucide-react";
import dynamic from "next/dynamic";
import ConfirmTimeModal from "@/components/admin/ConfirmTimeModal";
import { printComanda, printCocina, printCocinaIncremental, printPreCuenta, printPromoQrWeb, printFacturaFiscal } from "@/lib/printUtils";
import NuevoPedidoModal from "@/components/admin/NuevoPedidoModal";
import OrderPanelSettingsModal from "@/components/admin/OrderPanelSettingsModal";
import { useTenant } from "@/context/TenantContext";
import { useNotifications } from "@/context/NotificationContext";
import { descontarStockDePedido } from "@/lib/stockUtils";
import { getArgentinaDate, getStartOfDayArgentina, getEndOfDayArgentina, formatToArgentinaDateTime, formatToArgentinaTime } from "@/lib/dateUtils";
import { useHybridPedidos } from "@/hooks/useHybridPedidos";
import { db } from "@/lib/db";

const DynamicMap = dynamic(() => import("@/components/admin/PanelPedidosMap"), { ssr: false });

function groupSalonPedidos(pedidosList: Pedido[]): Pedido[] {
  const salonGroups: Record<string, Pedido[]> = {};
  const nonSalon: Pedido[] = [];

  pedidosList.forEach(p => {
    if (p.tipo === "salon" && p.mesa_id) {
      if (!salonGroups[p.mesa_id]) {
        salonGroups[p.mesa_id] = [];
      }
      salonGroups[p.mesa_id].push(p);
    } else {
      nonSalon.push(p);
    }
  });

  const groupedSalon: Pedido[] = [];

  Object.entries(salonGroups).forEach(([mesaId, group]) => {
    if (group.length === 1) {
      groupedSalon.push(group[0]);
      return;
    }

    // Sort by created_at ascending (oldest first) so we keep the main one
    group.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const main = group[0];

    // Merge items
    const mergedItems: PedidoItemType[] = [];
    group.forEach(p => {
      (p.pedido_items || []).forEach(item => {
        mergedItems.push(item);
      });
    });

    const totalSubtotal = group.reduce((sum, p) => sum + Number(p.subtotal || 0), 0);
    const totalTotal = group.reduce((sum, p) => sum + Number(p.total || 0), 0);
    const totalDescuento = group.reduce((sum, p) => sum + Number((p as any).descuento || 0), 0);
    const totalRecargo = group.reduce((sum, p) => sum + Number(p.recargo || 0), 0);
    const totalCubierto = group.reduce((sum, p) => sum + Number(p.cubierto_total || 0), 0);
    const totalComensales = group.reduce((sum, p) => sum + Number(p.comensales || 0), 0);

    const virtualPedido: Pedido = {
      ...main,
      pedido_items: mergedItems,
      subtotal: totalSubtotal,
      total: totalTotal,
      descuento: totalDescuento,
      recargo: totalRecargo,
      cubierto_total: totalCubierto,
      comensales: totalComensales,
      groupedIds: group.map(p => p.id), 
    } as any;

    groupedSalon.push(virtualPedido);
  });

  return [...nonSalon, ...groupedSalon];
}

type PedidoItemType = {
  id: string;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  notas?: string;
  adicionales?: { nombre: string; precio: number; cantidad?: number; impresora?: string }[];
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
  pedido_items: PedidoItemType[];
  created_at: string;
  repartidor_id?: string | null;
  tiempo_preparacion_minutos?: number;
  camarero?: { color: string } | null;
  camarero_id?: string | null;
  mesa_id?: string | null;
  metodo_pago_id?: string | null;
  recargo?: number;
  cubierto_total?: number;
  comensales?: number;
  descuento?: number;
  terminal_id?: string | null;
  notas_internas?: string;
};

const ESTADOS_3_COLUMNAS = [
  { key: "nuevos", label: "Nuevos", color: "bg-blue-500", icon: Clock, states: ["pendiente", "confirmado"] },
  { key: "preparacion", label: "En Cocina", color: "bg-orange-500", icon: ChefHat, states: ["preparando"] },
  { key: "listos", label: "Listos", color: "bg-green-500", icon: Bike, states: ["listo", "en_camino"] },
];

const TIPO_BADGE: Record<string, { label: string; class: string }> = {
  delivery: { label: "Delivery", class: "bg-blue-100 text-blue-700" },
  takeaway: { label: "Take Away", class: "bg-purple-100 text-purple-700" },
  salon: { label: "Salón", class: "bg-amber-100 text-amber-700" },
};

const ESTADO_OPTIONS = [
  { key: "pendiente", label: "Pendiente" },
  { key: "confirmado", label: "Confirmado" },
  { key: "preparando", label: "En Cocina" },
  { key: "listo", label: "Listo" },
  { key: "en_camino", label: "En camino" },
  { key: "entregado", label: "Entregado" },
  { key: "cancelado", label: "Cancelado" },
];

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR").format(n);
}

function aggregateAds(adicionales: any[]) {
  const counts: Record<string, { count: number; precio: number }> = {};
  adicionales.forEach(a => {
    const qty = a.cantidad || 1;
    if (!counts[a.nombre]) {
      counts[a.nombre] = { count: qty, precio: a.precio || 0 };
    } else {
      counts[a.nombre].count += qty;
    }
  });
  return Object.entries(counts).map(([nombre, data]) => ({
    nombre: data.count > 1 ? `${nombre} X ${data.count}` : nombre,
    precio: data.precio * data.count,
  }));
}

/* ── Bell sound (Web Audio API) ── */

const getLocalDate = () => getArgentinaDate();

export default function PanelPedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [repartidores, setRepartidores] = useState<any[]>([]);
  const [camareros, setCamareros] = useState<any[]>([]);
  const [waiterColors, setWaiterColors] = useState<Record<string, string>>({});
  const [metodosPago, setMetodosPago] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"todos" | "delivery" | "takeaway">("todos");
  const [busqueda, setBusqueda] = useState("");
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [modalTab, setModalTab] = useState<"detalle" | "repartidores">("detalle");
  const [confirmTimePedido, setConfirmTimePedido] = useState<Pedido | null>(null);
  const [isNuevoPedidoOpen, setIsNuevoPedidoOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [now, setNow] = useState(new Date());
  const [printConfig, setPrintConfig] = useState<any>(null);
  const [sucursalConfig, setSucursalConfig] = useState<any>(null);
  const [editingPedido, setEditingPedido] = useState<any>(null);
  const [fechaDesde, setFechaDesde] = useState(getLocalDate);
  const [fechaHasta, setFechaHasta] = useState(getLocalDate);
  const [promoActiva, setPromoActiva] = useState(false);
  const [terminalId, setTerminalId] = useState("1");
  const [preCuentaPedido, setPreCuentaPedido] = useState<Pedido | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setTerminalId(localStorage.getItem("terminal_id") || "1");
    }
  }, []);

  const { sucursalId } = useTenant();
  const { pedidos: hybridPedidos, lastSyncSource, refresh: refreshHybrid } = useHybridPedidos(
    sucursalId, 
    printConfig?.bridge_ip || "127.0.0.1"
  );
  const { playNotificationSound, enableAudio, audioEnabled } = useNotifications();

  useEffect(() => {
    if (!sucursalId) return;

    fetchPedidos();
    fetchRepartidores();
    fetchPrintConfig();
    fetchSucursalConfig();
    fetchWaiterColors();
    fetchMetodosPago();
    fetchPromoConfig();
    const interval = setInterval(() => fetchPedidos(), 30000);

    // Polling de seguridad cada 15 segundos
    const pollTimer = setInterval(() => {
      fetchPedidos(true);
    }, 15000);

    const channel = supabase
      .channel("pedidos-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos", filter: `sucursal_id=eq.${sucursalId}` }, (payload) => {
        fetchPedidos(true);
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      clearInterval(pollTimer);
      supabase.removeChannel(channel);
    };
  }, [sucursalId]);

  // When selectedPedido changes, reset to detalle tab
  useEffect(() => {
    if (selectedPedido) setModalTab("detalle");
  }, [selectedPedido?.id]);

  async function fetchPedidos(fromRealtime = false) {
    refreshHybrid();
  }

  async function fetchRepartidores() {
    if (!sucursalId) return;
    const { data } = await supabase.from("repartidores")
      .select("*")
      .eq("sucursal_id", sucursalId)
      .eq("activo", true);
    setRepartidores(data || []);
  }

  async function fetchPrintConfig() {
    if (!sucursalId) return;
    try {
      const { data } = await supabase.from("config_impresion").select("*").eq("sucursal_id", sucursalId).limit(1).maybeSingle();
      const { data: suc } = await supabase.from("config_sucursal").select("panel_settings").eq("sucursal_id", sucursalId).limit(1).maybeSingle();
      const { data: infoSuc } = await supabase.from("sucursales").select("nombre").eq("id", sucursalId).limit(1).maybeSingle();
      const boldMap = suc?.panel_settings?.print_bold || {};
      const fuente_adicionales = suc?.panel_settings?.fuente_adicionales;
      const impresoras = suc?.panel_settings?.impresoras || {};
      const bridge_ip = suc?.panel_settings?.bridge_ip || "127.0.0.1";
      const bridge_enabled = suc?.panel_settings?.bridge_enabled !== false;
      const nombre_local = infoSuc?.nombre || "MMM Pizza Artesanal";
      const fiscal = suc?.panel_settings?.fiscal || {};
      if (data) setPrintConfig({ ...data, boldMap, fuente_adicionales, impresoras, bridge_ip, nombre_local, bridge_enabled, fiscal });
      else setPrintConfig({ boldMap, fuente_adicionales, impresoras, bridge_ip, nombre_local, bridge_enabled, fiscal });
    } catch (err) {
      console.warn("[PanelPedidos] Error fetching print config from Supabase, trying Dexie...", err);
      try {
        const localConfig = await db.config_sucursal.where("sucursal_id").equals(sucursalId).first();
        if (localConfig) {
          const boldMap = localConfig.panel_settings?.print_bold || {};
          const fuente_adicionales = localConfig.panel_settings?.fuente_adicionales;
          const impresoras = localConfig.panel_settings?.impresoras || {};
          const bridge_ip = localConfig.panel_settings?.bridge_ip || "127.0.0.1";
          const bridge_enabled = localConfig.panel_settings?.bridge_enabled !== false;
          const nombre_local = localConfig.nombre || "MMM Pizza Artesanal";
          const fiscal = localConfig.panel_settings?.fiscal || {};
          setPrintConfig({ boldMap, fuente_adicionales, impresoras, bridge_ip, nombre_local, bridge_enabled, fiscal });
        }
      } catch (dexieErr) {
        console.error("[PanelPedidos] Error fetching config from Dexie:", dexieErr);
      }
    }
  }

  async function fetchSucursalConfig() {
    if (!sucursalId) return;
    const { data } = await supabase.from("config_sucursal").select("*").eq("sucursal_id", sucursalId).limit(1).maybeSingle();
    if (data) setSucursalConfig(data);
  }

  async function fetchWaiterColors() {
    if (!sucursalId) return;
    try {
      const res = await fetch(`/api/staff?sucursal_id=${sucursalId}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setCamareros(data);
        const map: Record<string, string> = {};
        data.forEach((u: any) => { if (u.color) map[u.id] = u.color; });
        setWaiterColors(map);
      }
    } catch (e) { console.error("Error fetching waiter colors:", e); }
  }

  async function fetchMetodosPago() {
    if (!sucursalId) return;
    const { data } = await supabase.from("metodos_pago").select("*").eq("sucursal_id", sucursalId).eq("activo", true);
    setMetodosPago(data || []);
  }

  async function fetchPromoConfig() {
    if (!sucursalId) return;
    const { data } = await supabase
      .from("promo_qr_config")
      .select("activo")
      .eq("sucursal_id", sucursalId)
      .maybeSingle();
    setPromoActiva(data?.activo ?? false);
  }

  async function cambiarMetodoPago(pedido: Pedido, metodoId: string) {
    const metodo = metodosPago.find(m => m.id === metodoId);
    if (!metodo) return;
    
    const recargoPorcentaje = Number(metodo.recargo_porcentaje || 0);

    const { data: mainOrder } = await supabase
      .from("pedidos")
      .select("subtotal, costo_envio, cubierto_total, descuento")
      .eq("id", pedido.id)
      .single();

    if (!mainOrder) return;

    const mainSubtotal = Number(mainOrder.subtotal || 0);
    const mainDescuento = Number(mainOrder.descuento || 0);
    const mainCostoEnvio = Number(mainOrder.costo_envio || 0);
    const mainCubiertoTotal = Number(mainOrder.cubierto_total || 0);

    const mergedSubtotal = Number(pedido.subtotal || 0);
    const mergedDescuento = Number((pedido as any).descuento || 0);
    
    const baseParaRecargo = mergedSubtotal - mergedDescuento;
    const recargo = baseParaRecargo > 0 ? Math.round((baseParaRecargo * recargoPorcentaje) / 100) : 0;
    const mainTotal = mainSubtotal + mainCostoEnvio + recargo + mainCubiertoTotal - mainDescuento;
    
    await supabase.from("pedidos").update({ 
      metodo_pago_id: metodoId,
      metodo_pago_nombre: metodo.nombre,
      recargo: recargo,
      total: mainTotal
    }).eq("id", pedido.id);
    
    fetchPedidos();
    if (selectedPedido?.id === pedido.id) {
      setSelectedPedido({ 
        ...pedido, 
        metodo_pago_id: metodoId,
        metodo_pago_nombre: metodo.nombre,
        recargo: recargo,
        total: (pedido.total - Number(pedido.recargo || 0)) + recargo
      });
    }
  }

  async function selectPreCuentaPayment(pedido: Pedido, metodoId: string) {
    const metodo = metodosPago.find(m => m.id === metodoId);
    if (!metodo) return;
    
    const recargoPorcentaje = Number(metodo.recargo_porcentaje || 0);

    const { data: mainOrder } = await supabase
      .from("pedidos")
      .select("subtotal, costo_envio, cubierto_total, descuento")
      .eq("id", pedido.id)
      .single();

    if (!mainOrder) return;

    const mainSubtotal = Number(mainOrder.subtotal || 0);
    const mainDescuento = Number(mainOrder.descuento || 0);
    const mainCostoEnvio = Number(mainOrder.costo_envio || 0);
    const mainCubiertoTotal = Number(mainOrder.cubierto_total || 0);

    const mergedSubtotal = Number(pedido.subtotal || 0);
    const mergedDescuento = Number((pedido as any).descuento || 0);
    
    const baseParaRecargo = mergedSubtotal - mergedDescuento;
    const recargo = baseParaRecargo > 0 ? Math.round((baseParaRecargo * recargoPorcentaje) / 100) : 0;
    const mainTotal = mainSubtotal + mainCostoEnvio + recargo + mainCubiertoTotal - mainDescuento;
    
    // Update the database
    await supabase.from("pedidos").update({ 
      metodo_pago_id: metodoId,
      metodo_pago_nombre: metodo.nombre,
      recargo: recargo,
      total: mainTotal
    }).eq("id", pedido.id);
    
    // Print the pre-cuenta with the updated details
    const printedPedido = {
      ...pedido,
      metodo_pago_id: metodoId,
      metodo_pago_nombre: metodo.nombre,
      recargo: recargo,
      total: (pedido.total - Number(pedido.recargo || 0)) + recargo,
      recargo_porcentaje: recargoPorcentaje
    };
    
    printPreCuenta(printedPedido, printConfig);
    
    setPreCuentaPedido(null);
    fetchPedidos();
    if (selectedPedido?.id === pedido.id) {
      setSelectedPedido(printedPedido);
    }
  }

  const sendWhatsAppNotification = useCallback((pedido: Pedido, type: 'confirmado' | 'listo' | 'entregado') => {
    if (!pedido.cliente_telefono) return;

    // Get template from settings or use default
    const templates = sucursalConfig?.panel_settings?.whatsapp_templates;
    let msg = "";

    if (type === 'confirmado') {
      msg = templates?.confirmado || `Tu pedido realizado a MMM ha sido confirmado.`;
    } else if (type === 'listo') {
      msg = templates?.listo || `TU PEDIDO YA ESTÁ LISTO Y EN CAMINO A TU DOMICILIO. QUE LO DISFRUTES!!!`;
    } else if (type === 'entregado') {
      msg = templates?.entregado || `¡Gracias por elegirnos! Esperamos que hayas disfrutado tu pedido.`;
    }

    if (!msg) return;

    const rawPhone = pedido.cliente_telefono.replace(/\D/g, "");
    const waPhone = rawPhone.startsWith("54") ? rawPhone : `54${rawPhone}`;
    const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  }, [sucursalConfig]);

  async function cambiarEstado(pedido: Pedido, nuevoEstado: string) {
    const ids = (pedido as any).groupedIds || [pedido.id];
    for (const id of ids) {
      if (nuevoEstado === "entregado") {
        const { data: mainOrder } = await supabase
          .from("pedidos")
          .select("subtotal, costo_envio, cubierto_total, descuento, recargo")
          .eq("id", id)
          .single();

        if (mainOrder) {
          const { data: itemsActuales } = await supabase
            .from("pedido_items")
            .select("precio_unitario, cantidad")
            .eq("pedido_id", id);

          const subtotalDB = (itemsActuales || []).reduce((sum: number, item: any) => {
            return sum + Number(item.precio_unitario || 0) * Number(item.cantidad || 1);
          }, 0);
          const costoEnvioActual = Number(mainOrder.costo_envio || 0);
          const descuentoActual = Number(mainOrder.descuento || 0);
          const recargoActual = Number(mainOrder.recargo || 0);
          const cubiertoTotalActual = Number(mainOrder.cubierto_total || 0);
          const totalDB = subtotalDB + costoEnvioActual + recargoActual + cubiertoTotalActual - descuentoActual;

          await supabase.from("pedidos").update({
            estado: nuevoEstado,
            subtotal: subtotalDB,
            total: totalDB,
          }).eq("id", id);
        }
      } else {
        await supabase.from("pedidos").update({ estado: nuevoEstado }).eq("id", id);
      }

      if (nuevoEstado === "preparando") {
        sendWhatsAppNotification(pedido, 'confirmado');
        if (sucursalId) descontarStockDePedido(id, sucursalId);
        const { data: rawPed } = await supabase
          .from("pedidos")
          .select("*, pedido_items(*)")
          .eq("id", id)
          .maybeSingle();
        if (rawPed) printCocina(rawPed, printConfig);
      } else if (nuevoEstado === "listo" || nuevoEstado === "en_camino") {
        sendWhatsAppNotification(pedido, 'listo');
      } else if (nuevoEstado === "entregado" || nuevoEstado === "cancelado") {
        sendWhatsAppNotification(pedido, 'entregado');
      }
    }

    if (nuevoEstado === "entregado" || nuevoEstado === "cancelado") {
      if (pedido.tipo === "salon" && (pedido as any).mesa_id) {
        await supabase.from("mesas").update({ estado: "libre" }).eq("id", (pedido as any).mesa_id);
      }
    }

    fetchPedidos();
    if (selectedPedido?.id === pedido.id) {
      setSelectedPedido({ ...pedido, estado: nuevoEstado });
    }
  }

  async function cerrarMesa(pedido: Pedido) {
    const ids = (pedido as any).groupedIds || [pedido.id];
    for (const id of ids) {
      const { data: mainOrder } = await supabase
        .from("pedidos")
        .select("subtotal, costo_envio, cubierto_total, descuento, recargo")
        .eq("id", id)
        .single();

      if (!mainOrder) continue;

      const { data: itemsActuales } = await supabase
        .from("pedido_items")
        .select("precio_unitario, cantidad, adicionales")
        .eq("pedido_id", id);

      const subtotalDB = (itemsActuales || []).reduce((sum: number, item: any) => {
        return sum + Number(item.precio_unitario || 0) * Number(item.cantidad || 1);
      }, 0);
      const costoEnvioActual = Number(mainOrder.costo_envio || 0);
      const descuentoActual = Number(mainOrder.descuento || 0);
      const recargoActual = Number(mainOrder.recargo || 0);
      const cubiertoTotalActual = Number(mainOrder.cubierto_total || 0);
      const totalReal = subtotalDB + costoEnvioActual + recargoActual + cubiertoTotalActual - descuentoActual;

      await supabase.from("pedidos").update({
        estado: "entregado",
        subtotal: subtotalDB,
        total: totalReal,
      }).eq("id", id);
    }

    if ((pedido as any).mesa_id) {
      await supabase.from("mesas").update({ estado: "libre" }).eq("id", (pedido as any).mesa_id);
    }
    setSelectedPedido(null);
    fetchPedidos();
  }

  async function asignarRepartidor(pedidoId: string, repartidorId: string) {
    await supabase.from("pedidos").update({ repartidor_id: repartidorId }).eq("id", pedidoId);
    fetchPedidos();
  }

  async function asignarCamarero(pedidoId: string, camareroId: string) {
    await supabase.from("pedidos").update({ camarero_id: camareroId }).eq("id", pedidoId);
    fetchPedidos();
    if (selectedPedido?.id === pedidoId) {
      setSelectedPedido({ ...selectedPedido, camarero_id: camareroId });
    }
  }

  async function handleConfirmOrder(minutes: number) {
    if (!confirmTimePedido) return;
    const pedido = confirmTimePedido;
    setConfirmTimePedido(null); // Clear immediately to prevent double-click / duplicate runs!

    await supabase.from("pedidos").update({
      estado: "preparando",
      tiempo_preparacion_minutos: minutes
    }).eq("id", pedido.id);

    // Auto-print comanda according to local settings. Kitchen ticket is handled automatically by GlobalAutoPrinter.
    const printOnConfirm = sucursalConfig?.panel_settings?.imprimir_al_confirmar ?? false;
    if (printOnConfirm) {
      printComanda(pedido, printConfig);
    }

    // Enviar WhatsApp de confirmación
    sendWhatsAppNotification(pedido, 'confirmado');

    // Descontar stock
    if (sucursalId) {
      descontarStockDePedido(pedido.id, sucursalId);
    }

    fetchPedidos();
  }
  const groupedPedidos = groupSalonPedidos(hybridPedidos || []);
  const filtrados = groupedPedidos.filter(p => {
    if (filtro !== "todos" && p.tipo !== filtro) return false;
    if (busqueda && !p.cliente_nombre?.toLowerCase().includes(busqueda.toLowerCase()) &&
      !p.numero_pedido?.toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });

  const getPedidosPorColumna = (columnKey: string) => {
    const colConfig = ESTADOS_3_COLUMNAS.find(c => c.key === columnKey);
    if (!colConfig) return [];
    return filtrados.filter(p => colConfig.states.includes(p.estado));
  };

  function getElapsedMinutes(dateStr: string) {
    return Math.floor((now.getTime() - new Date(dateStr).getTime()) / 60000);
  }

  function formatHora(dateStr: string) {
    return formatToArgentinaTime(dateStr);
  }

  function formatFechaCorta(dateStr: string) {
    return formatToArgentinaDateTime(dateStr).split(",")[0];
  }

  const tipoLabel = (t: string) =>
    t === "delivery" ? "Delivery" : t === "takeaway" ? "Take Away" : "Salón";

  /* ─── RENDER ─── */
  return (
    <div className="flex h-full">
      {/* Main area */}
      <div className="flex-1 flex flex-col">
        {/* Top filters */}
        <div className="px-6 py-2 flex items-center justify-between border-b border-gray-100 bg-slate-50/80">
          <div className="flex items-center gap-2">
             <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold ${
               lastSyncSource === 'supabase' ? 'bg-green-100 text-green-700' :
               lastSyncSource === 'bridge' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
             }`}>
               <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                 lastSyncSource === 'supabase' ? 'bg-green-500' :
                 lastSyncSource === 'bridge' ? 'bg-blue-500' : 'bg-orange-500'
               }`} />
               {lastSyncSource === 'supabase' ? 'CONECTADO (CLOUD)' : 
                lastSyncSource === 'bridge' ? 'MODO LOCAL (LAN)' : 'SIN CONEXIÓN'}
             </div>
             {lastSyncSource !== 'supabase' && (
               <span className="text-[10px] text-gray-400 italic">Usando Hub Local en {printConfig?.bridge_ip}</span>
             )}

             {/* Selector de Terminal */}
             <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 ml-4 shadow-sm hover:border-[#7B1FA2] transition-all">
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider select-none">🖨️ Terminal</span>
               <select
                 value={terminalId}
                 onChange={(e) => {
                   const val = e.target.value;
                   setTerminalId(val);
                   localStorage.setItem("terminal_id", val);
                 }}
                 className="text-[10px] font-extrabold text-slate-700 bg-transparent outline-none cursor-pointer border-none p-0 pr-1 select-none focus:ring-0"
               >
                 <option value="1">Terminal 1</option>
                 <option value="2">Terminal 2</option>
                 <option value="3">Terminal 3</option>
                 <option value="4">Terminal 4</option>
                 <option value="5">Terminal 5</option>
               </select>
             </div>
          </div>
        </div>

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

          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
            <input
              type="date"
              value={fechaDesde}
              onChange={e => { setFechaDesde(e.target.value); }}
              className="text-xs font-bold text-gray-700 outline-none bg-transparent"
            />
            <span className="text-gray-300">—</span>
            <input
              type="date"
              value={fechaHasta}
              onChange={e => { setFechaHasta(e.target.value); }}
              className="text-xs font-bold text-gray-700 outline-none bg-transparent"
            />
            <button
              onClick={() => fetchPedidos()}
              className="ml-1 px-2 py-1 bg-purple-600 text-white text-[10px] font-bold rounded-lg hover:bg-purple-700 transition-colors"
            >
              Filtrar
            </button>
          </div>

          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-tighter">Mapa</span>
            <button
              onClick={async () => {
                const newValue = !sucursalConfig?.panel_settings?.ocultar_mapa_delivery;
                const newSettings = { ...sucursalConfig?.panel_settings, ocultar_mapa_delivery: newValue };
                setSucursalConfig({ ...sucursalConfig, panel_settings: newSettings });
                if (sucursalConfig?.id) {
                  await supabase.from("config_sucursal").update({ panel_settings: newSettings }).eq("id", sucursalConfig.id);
                }
              }}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${!sucursalConfig?.panel_settings?.ocultar_mapa_delivery ? "bg-purple-600" : "bg-gray-300"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${!sucursalConfig?.panel_settings?.ocultar_mapa_delivery ? "translate-x-4" : "translate-x-1"}`} />
            </button>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => { enableAudio(); playNotificationSound(); }}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 border ${
                audioEnabled
                  ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                  : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
              }`}
              title={audioEnabled ? "Sonido activo — click para probar" : "Habilitar sonido de notificación"}
            >
              🔔
              <span>{audioEnabled ? "Sonido activo" : "Activar sonido"}</span>
              {/* Toggle pill */}
              <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors duration-200 ${audioEnabled ? "bg-green-500" : "bg-gray-300"}`}>
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform duration-200 ${audioEnabled ? "translate-x-3.5" : "translate-x-0.5"}`} />
              </span>
            </button>
            <div className="flex items-stretch bg-purple-100 rounded-xl shadow-sm border border-purple-200">
              <button
                onClick={() => {
                  const tenant = window.location.pathname.split('/')[1];
                  const promoQrUrl = `${window.location.origin}/${tenant}`;
                  const texto = sucursalConfig?.panel_settings?.promo_qr_text || "#GRACIAS POR ELEGIRNOS";
                  const imageUrl = sucursalConfig?.panel_settings?.promo_qr_image_url;
                  printPromoQrWeb(promoQrUrl, texto, imageUrl, printConfig);
                }}
                className="flex items-center gap-2 text-purple-700 px-3 py-2.5 rounded-l-xl text-xs font-bold hover:bg-purple-200 transition-all active:scale-95"
                title="Imprimir QR de Promo Web"
              >
                <QrCode size={16} /> Promo QR
              </button>
              <div className="w-px bg-purple-200 my-1"></div>
              <button
                onClick={() => {
                  const prev = sucursalConfig?.panel_settings?.promo_qr_text || "#GRACIAS POR ELEGIRNOS";
                  const texto = window.prompt("Ingresa el mensaje personalizado para el ticket:", prev);
                  if (texto !== null && texto !== prev) {
                    const newSettings = { ...sucursalConfig?.panel_settings, promo_qr_text: texto };
                    setSucursalConfig({ ...sucursalConfig, panel_settings: newSettings });
                    if (sucursalConfig?.id) {
                      supabase.from("config_sucursal").update({ panel_settings: newSettings }).eq("id", sucursalConfig.id).then();
                    }
                  }
                }}
                className="flex items-center justify-center px-2 text-purple-700 rounded-r-xl hover:bg-purple-200 transition-all active:scale-95"
                title="Configurar texto del ticket"
              >
                <SettingsIcon size={14} />
              </button>
            </div>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all active:scale-95"
              title="Ajustes del panel de pedidos"
            >
              <SettingsIcon size={20} />
            </button>
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
          <div className={`${sucursalConfig?.panel_settings?.ocultar_mapa_delivery ? "w-full" : "w-1/2"} overflow-x-auto border-r border-gray-100 bg-slate-50/50`}>
            <div className="flex gap-4 p-4 min-w-[800px] h-full">
              {ESTADOS_3_COLUMNAS.map(coluna => {
                const col = getPedidosPorColumna(coluna.key);
                return (
                  <div key={coluna.key} className="flex-1 flex flex-col min-w-[250px]">
                    <div className="flex items-center justify-between mb-4 px-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${coluna.color}`} />
                        <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-tight">{col.length} {coluna.label}</h3>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pb-6 pr-1">
                      {col.length === 0 ? (
                        <div className="text-center py-10 opacity-30 border-2 border-dashed border-gray-200 rounded-2xl">
                          <coluna.icon size={24} className="mx-auto mb-2 text-gray-400" />
                          <p className="text-[11px] font-medium text-gray-500">Vacío</p>
                        </div>
                      ) : col.map(pedido => {
                        const elapsed = getElapsedMinutes(pedido.created_at);
                        const isLate = elapsed > 60;
                        const isWarning = elapsed > 40 && elapsed <= 60;
                        const numCorto = pedido.numero_pedido?.split("-").pop() ?? pedido.numero_pedido;
                        const tituloCard = pedido.tipo === "salon" && (pedido as any).mesas?.numero
                          ? `Mesa ${(pedido as any).mesas.numero}`
                          : `N°${numCorto}`;

                          return (
                            <div
                              key={pedido.id}
                              onClick={() => setSelectedPedido(pedido)}
                              className={`w-full text-left rounded-2xl overflow-hidden border transition-all cursor-pointer hover:shadow-lg active:scale-[0.99] ${selectedPedido?.id === pedido.id ? "border-[#7B1FA2] ring-2 ring-[#7B1FA2]/10 bg-white" : "border-gray-200 bg-white shadow-sm"}`}
                            >
                              {pedido.tipo === "salon" ? (
                                <div 
                                  className="px-4 py-2 text-center"
                                  style={{ backgroundColor: (pedido.camarero_id && waiterColors[pedido.camarero_id]) || pedido.camarero?.color || "#f3f4f6" }}
                                >
                                  <span className="text-[14px] font-black text-white drop-shadow-sm uppercase">
                                    MESA {(pedido as any).mesas?.numero || "?"}
                                  </span>
                                </div>
                              ) : (
                                <div className="p-4 pb-2">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] font-black text-gray-900">{tituloCard} {tipoLabel(pedido.tipo)} <span className="text-[10px] font-bold text-green-600 ml-1">POS</span></span>
                                    <span className="text-[10px] text-gray-400 font-bold">{elapsed} mins</span>
                                  </div>
                                </div>
                              )}

                              <div className="px-4 pb-4">
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-[10px] text-gray-400 font-bold">{pedido.metodo_pago_nombre || "Efectivo"} | {pedido.cliente_nombre?.toLowerCase()}</span>
                                  {pedido.tipo !== "salon" && <span className="text-[10px] text-gray-400 font-bold">{elapsed} mins</span>}
                                </div>
                                <div className={`h-1.5 w-full rounded-full mt-3 ${isLate ? "bg-red-500" : isWarning ? "bg-orange-500" : "bg-gray-100"}`} />
                              </div>
                            </div>
                          );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mapa */}
          {!sucursalConfig?.panel_settings?.ocultar_mapa_delivery && (
            <div className="hidden lg:block w-1/2 bg-white relative">
              <DynamicMap
                sucursalId={sucursalId}
                pedidos={filtrados.filter(p => p.tipo === "delivery" && p.cliente_lat != null)}
                selectedPedidoId={selectedPedido?.id || null}
                onSelectPedido={(id) => {
                  const found = pedidos.find(p => p.id === id);
                  if (found) setSelectedPedido(found);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL DETALLE PEDIDO (Pedisy style) ── */}
      {selectedPedido && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
          onClick={() => setSelectedPedido(null)}
        >
          <div
            className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-gray-900">
                  {selectedPedido.tipo === "salon" && (selectedPedido as any).mesas?.numero
                    ? `Mesa ${(selectedPedido as any).mesas.numero}`
                    : `${tipoLabel(selectedPedido.tipo)} N°${selectedPedido.numero_pedido?.split("-").pop() ?? selectedPedido.numero_pedido}`
                  }
                </h3>
                <span className="bg-green-100 text-green-700 text-[10px] font-black px-2.5 py-1 rounded-md uppercase">POS</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative group">
                  <label className="absolute -top-2.5 left-3 px-1 bg-white text-[9px] font-semibold text-gray-400 uppercase z-10">Estado</label>
                  <select
                    value={selectedPedido.estado}
                    onChange={e => cambiarEstado(selectedPedido, e.target.value)}
                    className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 bg-white cursor-pointer focus:ring-2 focus:ring-purple-500 outline-none appearance-auto"
                  >
                    {ESTADO_OPTIONS.map(opt => (
                      <option key={opt.key} value={opt.key}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm(`¿Eliminar definitivamente este pedido? Esta acción no se puede deshacer.`)) return;
                    const ids = (selectedPedido as any).groupedIds || [selectedPedido.id];
                    for (const id of ids) {
                      await supabase.from("pedido_items").delete().eq("pedido_id", id);
                      await supabase.from("pedidos").delete().eq("id", id);
                    }
                    setSelectedPedido(null);
                    fetchPedidos();
                  }}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Eliminar pedido definitivamente"
                >
                  <Trash2 size={18} />
                </button>
                <button onClick={() => setSelectedPedido(null)} className="text-gray-400 hover:text-gray-700 p-1 transition-colors">
                  <X size={22} />
                </button>
              </div>
            </div>

            {/* ── Body ── */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left Panel — Items Table */}
              <div className="flex-1 overflow-y-auto p-6 border-r border-gray-100">
                <table className="w-full">
                  <thead>
                    <tr className="text-[11px] text-gray-400 uppercase font-semibold border-b border-gray-100">
                      <td className="pb-3">{(selectedPedido.pedido_items ?? []).length} Producto</td>
                      <td className="pb-3 text-right">P. original</td>
                      <td className="pb-3 text-right">P. final</td>
                      <td className="pb-3 text-right">Total</td>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {(selectedPedido.pedido_items ?? []).map((item: PedidoItemType) => (
                      <tr key={item.id} className="border-b border-gray-50">
                        <td className="py-4 font-semibold text-gray-800">
                          {item.cantidad} {item.nombre_producto}
                          {item.adicionales && item.adicionales.length > 0 && (
                            <div className="text-[10px] text-gray-400 mt-1 space-y-0.5">
                              {aggregateAds(item.adicionales).map((a, i) => <div key={i}>+ {a.nombre}</div>)}
                            </div>
                          )}
                          {item.notas && (
                            <div className="text-[10px] text-gray-400 mt-1 italic">📝 {item.notas}</div>
                          )}
                        </td>
                        <td className="py-4 text-right text-gray-500">$ {fmt(item.precio_unitario)}</td>
                        <td className="py-4 text-right text-gray-500">$ {fmt(item.precio_unitario)}</td>
                        <td className="py-4 text-right font-bold text-gray-900">$ {fmt(item.precio_unitario * item.cantidad)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div className="mt-6 space-y-2">
                  <div className="flex justify-between items-center text-sm font-semibold text-gray-700 border-t border-gray-100 pt-4">
                    <span>Productos</span>
                    <span>$ {fmt(selectedPedido.subtotal)}</span>
                  </div>
                  {(selectedPedido.costo_envio ?? 0) > 0 && (
                    <div className="flex justify-between items-center text-sm text-gray-500">
                      <span>Costo de envío</span>
                      <span>$ {fmt(selectedPedido.costo_envio)}</span>
                    </div>
                  )}
                  {((selectedPedido as any).cubierto_total ?? 0) > 0 && (
                    <div className="flex justify-between items-center text-sm text-gray-500">
                      <span>Cubiertos ({(selectedPedido as any).comensales || 1} pers.)</span>
                      <span>$ {fmt((selectedPedido as any).cubierto_total)}</span>
                    </div>
                  )}
                  {((selectedPedido as any).descuento ?? 0) > 0 && (
                    <div className="flex justify-between items-center text-sm text-green-600 font-bold">
                      <span>Descuentos</span>
                      <span>- $ {fmt((selectedPedido as any).descuento)}</span>
                    </div>
                  )}
                  {((selectedPedido as any).recargo ?? 0) > 0 && (
                    <div className="flex justify-between items-center text-sm text-amber-700 font-bold">
                      <span>Recargo de pago</span>
                      <span>$ {fmt((selectedPedido as any).recargo)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-base font-black text-gray-900 border-t border-gray-200 pt-3">
                    <span>Total ({selectedPedido.metodo_pago_nombre || "Efectivo"})</span>
                    <span>$ {fmt(selectedPedido.total)}</span>
                  </div>
                </div>
              </div>

              {/* Right Panel — Order Info */}
              <div className="w-[340px] flex flex-col bg-gray-50/50 overflow-y-auto">
                <div className="p-6 space-y-5 flex-1">
                  {/* Pedido # + Comandar/Editar */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-800">
                      Pedido <span className="text-purple-600">#{selectedPedido.numero_pedido}</span>
                    </span>
                    <button
                      onClick={() => {
                        setEditingPedido(selectedPedido);
                        setSelectedPedido(null);
                      }}
                      className="flex items-center gap-1.5 bg-gray-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-800 transition-colors"
                    >
                      Editar Pedido
                    </button>
                  </div>

                  {/* Client info rows */}
                  <div className="space-y-0 divide-y divide-gray-100 border border-gray-100 rounded-xl bg-white overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-gray-600">Cliente: {selectedPedido.cliente_nombre || "—"}</span>
                    </div>
                    {selectedPedido.cliente_telefono && (
                      <div className="flex items-center justify-between px-4 py-3">
                        <a
                          href={`https://wa.me/${selectedPedido.cliente_telefono.replace(/\D/g, "").replace(/^(?!54)/, "54")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-purple-600 font-medium hover:underline cursor-pointer"
                        >
                          WhatsApp: {selectedPedido.cliente_telefono}
                        </a>
                        <button
                          onClick={() => navigator.clipboard.writeText(selectedPedido.cliente_telefono)}
                          className="text-gray-300 hover:text-gray-500 transition-colors"
                          title="Copiar"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                        </button>
                      </div>
                    )}
                    {selectedPedido.cliente_direccion && (
                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-sm text-purple-600 font-medium truncate max-w-[180px]">{selectedPedido.cliente_direccion}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {(selectedPedido.cliente_lat && selectedPedido.cliente_lng) ? (
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPedido.cliente_lat},${selectedPedido.cliente_lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 bg-blue-50 text-blue-600 px-2.5 py-1.5 rounded-lg text-[10px] font-bold hover:bg-blue-100 transition-colors"
                              title="Abrir en Google Maps"
                            >
                              <ExternalLink size={12} /> Maps
                            </a>
                          ) : (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedPedido.cliente_direccion)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 bg-blue-50 text-blue-600 px-2.5 py-1.5 rounded-lg text-[10px] font-bold hover:bg-blue-100 transition-colors"
                              title="Buscar en Google Maps"
                            >
                              <ExternalLink size={12} /> Maps
                            </a>
                          )}
                          <button
                            onClick={() => navigator.clipboard.writeText(selectedPedido.cliente_direccion)}
                            className="text-gray-300 hover:text-gray-500 transition-colors"
                            title="Copiar"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Repartidor / Camarero dropdown */}
                  <div className="border border-gray-100 rounded-xl bg-white overflow-hidden">
                    {selectedPedido.tipo === "salon" ? (
                      <select
                        value={selectedPedido.camarero_id || ""}
                        onChange={e => asignarCamarero(selectedPedido.id, e.target.value)}
                        className="w-full px-4 py-3 text-sm text-gray-600 bg-transparent outline-none cursor-pointer"
                      >
                        <option value="">Camarero</option>
                        {camareros.map(c => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={selectedPedido.repartidor_id || ""}
                        onChange={e => asignarRepartidor(selectedPedido.id, e.target.value)}
                        className="w-full px-4 py-3 text-sm text-gray-600 bg-transparent outline-none cursor-pointer"
                      >
                        <option value="">Repartidor</option>
                        {repartidores.map(r => (
                          <option key={r.id} value={r.id}>{r.nombre}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Método de Pago dropdown */}
                  <div className="relative group border border-gray-100 rounded-xl bg-white overflow-hidden">
                    <label className="absolute top-1.5 left-4 text-[9px] font-bold text-gray-400 uppercase tracking-wider">Pago</label>
                    <select
                      value={metodosPago.find(m => m.nombre === selectedPedido.metodo_pago_nombre)?.id || ""}
                      onChange={e => cambiarMetodoPago(selectedPedido, e.target.value)}
                      className="w-full px-4 pt-5 pb-2 text-sm font-bold text-gray-800 bg-white cursor-pointer focus:ring-0 outline-none appearance-auto"
                    >
                      <option value="">Seleccionar pago...</option>
                      {metodosPago.map(m => (
                        <option key={m.id} value={m.id}>{m.nombre}</option>
                      ))}
                    </select>
                  </div>

                  {/* Payment & timestamps */}
                  <div className="space-y-0 divide-y divide-gray-100 border border-gray-100 rounded-xl bg-white overflow-hidden text-sm text-gray-600">
                    <div className="px-4 py-3">Pago: {selectedPedido.metodo_pago_nombre || "Efectivo"}</div>
                    <div className="px-4 py-3">Creado: {formatHora(selectedPedido.created_at)}, hace {getElapsedMinutes(selectedPedido.created_at)} mins.</div>
                    {selectedPedido.tiempo_preparacion_minutos && (
                      <div className="px-4 py-3">Preparación: {selectedPedido.tiempo_preparacion_minutos} minutos.</div>
                    )}
                  </div>

                  {/* Action buttons: Comandar / Cocina / PreCuenta / Cerrar Mesa */}
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => {
                      const tenant = window.location.pathname.split('/')[1];
                      const promoQrUrl = promoActiva
                        ? `${window.location.origin}/${tenant}/promo/${selectedPedido.id}`
                        : undefined;
                      printComanda(selectedPedido, { ...printConfig, promoQrUrl });
                    }} className="flex-1 bg-[#E8D5F5] hover:bg-[#d9c0f0] text-[#7B1FA2] py-3.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-colors">Comanda</button>
                    <button onClick={() => printCocina(selectedPedido, printConfig)} className="flex-1 bg-[#E8D5F5] hover:bg-[#d9c0f0] text-[#7B1FA2] py-3.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-colors">Cocina</button>
                    {selectedPedido.tipo === "salon" && (
                      <>
                        <button onClick={() => setPreCuentaPedido(selectedPedido)} className="flex-1 bg-amber-100 hover:bg-amber-200 text-amber-800 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-colors">Pre-Cuenta</button>
                        <button onClick={() => {
                          if (confirm(`¿Cerrar mesa y marcar pedido como entregado?`)) cerrarMesa(selectedPedido);
                        }} className="flex-1 bg-green-100 hover:bg-green-200 text-green-800 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-colors">Cerrar Mesa</button>
                      </>
                    )}
                    {printConfig.fiscal?.habilitado && (
                      <button onClick={() => printFacturaFiscal(selectedPedido, printConfig)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-emerald-100 mt-1">🖨️ Factura Fiscal</button>
                    )}
                  </div>
                </div>

                {/* Footer: Cancel + Primary Action */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-white">
                  <button
                    onClick={() => { cambiarEstado(selectedPedido, "cancelado"); setSelectedPedido(null); }}
                    className="text-red-500 text-sm font-semibold hover:underline"
                  >
                    Cancelar pedido
                  </button>
                  {selectedPedido.estado === "pendiente" && (
                    <button
                      onClick={() => { setConfirmTimePedido(selectedPedido); setSelectedPedido(null); }}
                      className="bg-gray-900 text-white font-bold px-6 py-3 rounded-xl text-sm hover:bg-gray-800 transition-colors"
                    >
                      Confirmar
                    </button>
                  )}
                  {selectedPedido.estado === "confirmado" && (
                    <button onClick={() => cambiarEstado(selectedPedido, "preparando")} className="bg-orange-500 text-white font-bold px-6 py-3 rounded-xl text-sm">Comenzar Cocina</button>
                  )}
                  {selectedPedido.estado === "preparando" && (
                    <button onClick={() => cambiarEstado(selectedPedido, "listo")} className="bg-green-600 text-white font-bold px-6 py-3 rounded-xl text-sm">Marcar Listo</button>
                  )}
                  {selectedPedido.estado === "listo" && (
                    <button onClick={() => cambiarEstado(selectedPedido, "en_camino")} className="bg-purple-600 text-white font-bold px-6 py-3 rounded-xl text-sm">Despachar</button>
                  )}
                  {selectedPedido.estado === "en_camino" && (
                    <button onClick={() => { cambiarEstado(selectedPedido, "entregado"); setSelectedPedido(null); }} className="bg-gray-900 text-white font-bold px-6 py-3 rounded-xl text-sm">Entregado</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}



      <OrderPanelSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        configId={sucursalConfig?.id}
        initialSettings={sucursalConfig?.panel_settings}
        onSettingsUpdated={(newSettings) => setSucursalConfig({ ...sucursalConfig, panel_settings: newSettings })}
      />

      <ConfirmTimeModal
        isOpen={confirmTimePedido !== null}
        onClose={() => setConfirmTimePedido(null)}
        onConfirm={handleConfirmOrder}
        orderNumber={confirmTimePedido?.numero_pedido || ""}
      />

      {preCuentaPedido && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-amber-500 p-4 text-white">
              <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
                <SettingsIcon size={18} />
                Método de Pago
              </h3>
              <p className="text-[10px] opacity-90 mt-1">
                Seleccioná la forma de pago para el Cierre de Mesa (Mesa {preCuentaPedido.tipo === 'salon' ? (preCuentaPedido.mesa_id ? (preCuentaPedido as any).mesas?.numero || 'Salón' : 'Salón') : '#' + preCuentaPedido.numero_pedido})
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">
                Forma de Pago:
              </label>
              
              <div className="grid grid-cols-2 gap-2">
                {metodosPago.map((m) => {
                  const isCurrent = preCuentaPedido.metodo_pago_nombre === m.nombre;
                  return (
                    <button
                      key={m.id}
                      onClick={() => selectPreCuentaPayment(preCuentaPedido, m.id)}
                      className={`py-3 px-2 rounded-xl text-[10px] font-black uppercase transition-all border-2 flex flex-col items-center justify-center gap-1 ${
                        isCurrent
                          ? "bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-200"
                          : "bg-white text-gray-500 border-gray-100 hover:border-amber-200"
                      }`}
                    >
                      <span>{m.nombre}</span>
                      {Number(m.recargo_porcentaje || 0) > 0 && (
                        <span className={`text-[8px] ${isCurrent ? 'text-amber-100' : 'text-amber-600'}`}>
                          (+{m.recargo_porcentaje}%)
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {metodosPago.length === 0 && (
                <button
                  onClick={() => {
                    printPreCuenta(preCuentaPedido, printConfig);
                    setPreCuentaPedido(null);
                  }}
                  className="w-full py-3 bg-amber-500 text-white font-black text-[10px] rounded-xl uppercase tracking-widest hover:bg-amber-600 transition-colors"
                >
                  🖨️ Imprimir sin método de pago
                </button>
              )}

              <div className="flex gap-3 pt-2 border-t border-gray-100 mt-2">
                <button 
                  onClick={() => setPreCuentaPedido(null)}
                  className="w-full py-2.5 text-[10px] font-black text-gray-400 hover:text-gray-600 uppercase tracking-widest transition-colors text-center"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <NuevoPedidoModal
        isOpen={isNuevoPedidoOpen || !!editingPedido}
        onClose={() => { setIsNuevoPedidoOpen(false); setEditingPedido(null); }}
        onCreated={() => { fetchPedidos(); setIsNuevoPedidoOpen(false); setEditingPedido(null); }}
        editPedido={editingPedido || undefined}
      />
    </div>
  );
}
