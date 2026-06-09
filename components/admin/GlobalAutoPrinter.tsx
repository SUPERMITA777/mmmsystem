"use client";

import { useState, useEffect, useRef } from "react";
import { useTenant } from "@/context/TenantContext";
import { useHybridPedidos } from "@/hooks/useHybridPedidos";
import { supabase } from "@/lib/supabaseClient";
import { db } from "@/lib/db";
import { printCocina, printPreCuenta } from "@/lib/printUtils";

/**
 * GlobalAutoPrinter — Componente global invisible que corre en el layout de administración.
 * Escucha cambios en tiempo real y gestiona la impresión automática de comandes de cocina
 * y pre-cuentas, independientemente de la página en la que se encuentre el usuario (Mapa de Salón, Panel de Pedidos, etc.)
 */
export default function GlobalAutoPrinter() {
  const { sucursalId } = useTenant();
  const [printConfig, setPrintConfig] = useState<any>(null);
  const [sucursalConfig, setSucursalConfig] = useState<any>(null);
  const [terminalId, setTerminalId] = useState("1");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setTerminalId(localStorage.getItem("terminal_id") || "1");
    }
  }, []);

  const { pedidos: hybridPedidos, refresh: refreshHybrid } = useHybridPedidos(
    sucursalId,
    printConfig?.bridge_ip || "127.0.0.1"
  );

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
      setPrintConfig({ boldMap, fuente_adicionales, impresoras, bridge_ip, nombre_local, bridge_enabled, fiscal });
    } catch (err) {
      console.warn("[GlobalAutoPrinter] Error cargando config desde Supabase, intentando Dexie...", err);
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
        console.error("[GlobalAutoPrinter] Error al obtener config desde Dexie:", dexieErr);
      }
    }
  }

  async function fetchSucursalConfig() {
    if (!sucursalId) return;
    try {
      const { data } = await supabase.from("config_sucursal").select("*").eq("sucursal_id", sucursalId).limit(1).maybeSingle();
      if (data) setSucursalConfig(data);
    } catch (e) {
      console.error("[GlobalAutoPrinter] Error fetching sucursal config:", e);
    }
  }

  // Suscripción Realtime y Sondeo de Seguridad para Pedidos Activos
  useEffect(() => {
    if (!sucursalId) return;

    fetchPrintConfig();
    fetchSucursalConfig();

    const interval = setInterval(() => refreshHybrid(), 30000);
    const pollTimer = setInterval(() => refreshHybrid(), 15000);

    const channel = supabase
      .channel("global-pedidos-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos", filter: `sucursal_id=eq.${sucursalId}` }, (payload) => {
        refreshHybrid();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      clearInterval(pollTimer);
      supabase.removeChannel(channel);
    };
  }, [sucursalId]);

  const autoPrintedIdsRef = useRef<Set<string>>(new Set());
  const autoPrintedItemQtyRef = useRef<Map<string, number>>(new Map());
  const isFirstLoadRef = useRef<boolean>(true);
  const printedPrecuentasRef = useRef<Map<string, string>>(new Map());

  // Loop de Impresión Automática
  useEffect(() => {
    if (!hybridPedidos || hybridPedidos.length === 0 || !printConfig) return;

    if (isFirstLoadRef.current) {
      // Cargar desde localStorage para no re-imprimir cosas de pestañas anteriores o reloads
      if (typeof window !== "undefined") {
        try {
          const legacyIds = localStorage.getItem("printed_item_ids");
          const storedItemQtys = localStorage.getItem("printed_item_qtys");
          
          if (legacyIds && !storedItemQtys) {
            try {
              const idsArray = JSON.parse(legacyIds);
              const migratedObj: Record<string, number> = {};
              idsArray.forEach((id: string) => {
                migratedObj[id] = 1;
                autoPrintedItemQtyRef.current.set(id, 1);
              });
              localStorage.setItem("printed_item_qtys", JSON.stringify(migratedObj));
              localStorage.removeItem("printed_item_ids");
            } catch (e) {
              console.error("Error migrating printed_item_ids", e);
            }
          } else if (storedItemQtys) {
            try {
              const obj = JSON.parse(storedItemQtys);
              Object.entries(obj).forEach(([id, qty]) => {
                autoPrintedItemQtyRef.current.set(id, Number(qty));
              });
            } catch (e) {
              console.error("Error parsing printed_item_qtys", e);
            }
          }

          const storedOrderIds = JSON.parse(localStorage.getItem("printed_order_ids") || "[]");
          storedOrderIds.forEach((id: string) => autoPrintedIdsRef.current.add(id));
        } catch (e) {
          console.error("Error loading printed IDs from localStorage", e);
        }
      }

      // Marcar ítems existentes de más de 2 minutos para evitar reimpresión al iniciar sesión
      const dosMinutosAtras = new Date(Date.now() - 2 * 60 * 1000);
      hybridPedidos.forEach(p => {
        const items = p.pedido_items || [];
        items.forEach((it: any) => {
          const itemCreatedAt = it.created_at ? new Date(it.created_at) : new Date(p.created_at);
          if (itemCreatedAt < dosMinutosAtras) {
            autoPrintedItemQtyRef.current.set(it.id, it.cantidad || 1);
          }
        });

        if (new Date(p.created_at) < dosMinutosAtras) {
          autoPrintedIdsRef.current.add(p.id);
          const notas = p.notas_internas || "";
          if (notas.toUpperCase().includes("PRECUENTA")) {
            printedPrecuentasRef.current.set(p.id, notas);
          }
        }
      });

      // Guardar de vuelta en localStorage los inicializados
      if (typeof window !== "undefined") {
        try {
          const obj: Record<string, number> = {};
          autoPrintedItemQtyRef.current.forEach((val, key) => {
            obj[key] = val;
          });
          localStorage.setItem("printed_item_qtys", JSON.stringify(obj));
          localStorage.setItem("printed_order_ids", JSON.stringify(Array.from(autoPrintedIdsRef.current).slice(-1000)));
        } catch (e) {}
      }

      isFirstLoadRef.current = false;
      console.log("[GlobalAutoPrint] Inicializado listado de pedidos impresos. Viejos ignorados:", autoPrintedIdsRef.current.size);
    }

    const autoPrintEnabled = sucursalConfig?.panel_settings?.imprimir_al_recibir !== false;
    const printOnConfirm = sucursalConfig?.panel_settings?.imprimir_al_confirmar ?? false;

    hybridPedidos.forEach((pedido) => {
      // Ruteo de terminal:
      // Si el pedido tiene un terminal_id válido asignado, lo imprime únicamente ese terminal.
      // Si el pedido NO tiene terminal_id (es null, undefined o vacío), por defecto lo imprime la Terminal 1.
      const pedTerminal = pedido.terminal_id ? String(pedido.terminal_id).trim() : "";
      let targetTerminal = "1";
      if (pedTerminal && pedTerminal !== "null" && pedTerminal !== "undefined" && pedTerminal !== "") {
        targetTerminal = pedTerminal;
      }

      if (String(terminalId) !== targetTerminal) {
        return;
      }

      // 1. Auto-impresión de comanda de cocina para nuevos ítems
      const printForCurrentState = 
        (pedido.estado === "pendiente" && autoPrintEnabled) ||
        ((pedido.estado === "confirmado" || pedido.estado === "preparando") && (autoPrintEnabled || printOnConfirm));

      if (printForCurrentState) {
        const allItems = pedido.pedido_items || [];
        if (allItems.length > 0) {
          // Primero recargamos de localStorage por si otra pestaña ya los marcó
          if (typeof window !== "undefined") {
            try {
              const storedItemQtys = JSON.parse(localStorage.getItem("printed_item_qtys") || "{}");
              Object.entries(storedItemQtys).forEach(([id, qty]) => {
                autoPrintedItemQtyRef.current.set(id, Number(qty));
              });
            } catch (e) {}
          }

          // Identificar ítems nuevos o con incremento de cantidad
          const newItemsToPrint: any[] = [];
          allItems.forEach((item: any) => {
            const printedQty = autoPrintedItemQtyRef.current.get(item.id) || 0;
            if (item.cantidad > printedQty) {
              const diffQty = item.cantidad - printedQty;
              newItemsToPrint.push({
                ...item,
                cantidad: diffQty // Mandar a imprimir solo la diferencia
              });
            }
          });

          if (newItemsToPrint.length > 0) {
            console.log(`[GlobalAutoPrint] Detectados ${newItemsToPrint.length} ítems nuevos o incrementados en pedido:`, pedido.numero_pedido);
            
            // Marcar inmediatamente en el Ref e intentar guardar en localStorage
            newItemsToPrint.forEach((item: any) => {
              const currentPrinted = autoPrintedItemQtyRef.current.get(item.id) || 0;
              autoPrintedItemQtyRef.current.set(item.id, currentPrinted + item.cantidad);
            });
            autoPrintedIdsRef.current.add(pedido.id);

            if (typeof window !== "undefined") {
              try {
                const obj: Record<string, number> = {};
                autoPrintedItemQtyRef.current.forEach((val, key) => {
                  obj[key] = val;
                });
                const keys = Object.keys(obj).slice(-1000);
                const slicedObj: Record<string, number> = {};
                keys.forEach(k => { slicedObj[k] = obj[k]; });
                localStorage.setItem("printed_item_qtys", JSON.stringify(slicedObj));
                localStorage.setItem("printed_order_ids", JSON.stringify(Array.from(autoPrintedIdsRef.current).slice(-1000)));
              } catch (e) {}
            }

            try {
              printCocina(pedido, printConfig, newItemsToPrint);
            } catch (err) {
              console.error("[GlobalAutoPrint] Error al imprimir cocina automáticamente:", err);
            }
          }
        }
      }

      // 2. Auto-impresión de Pre-cuenta solicitada desde celulares
      // IMPORTANTE: si notas_internas tiene formato "PRECUENTA|{timestamp}", significa que
      // panel-pedidos ya la imprimió directamente — GlobalAutoPrinter debe ignorarla
      // para evitar doble impresión. Solo procesa el formato legado "PRECUENTA" plano (desde QR).
      const notas = pedido.notas_internas || "";
      if (notas.toUpperCase().includes("PRECUENTA") && !notas.startsWith("PRECUENTA|")) {
        const lastPrintedValue = printedPrecuentasRef.current.get(pedido.id);
        if (lastPrintedValue !== notas) {
          console.log(`[GlobalAutoPrint] Solicitud de Pre-Cuenta QR detectada para pedido:`, pedido.numero_pedido);
          printedPrecuentasRef.current.set(pedido.id, notas);
          
          if (pedido.metodo_pago_id || notas.toUpperCase().includes("MIXTO")) {
            printPreCuenta(pedido, printConfig);
          }
        }
      }

      // 3. Guard de Cierre de Mesa / Cobro
      // Si el pedido tiene formato de cobro directo "COBRO|{timestamp}", lo ignoramos para evitar doble print.
      if ((pedido.estado === "entregado" || notas.toUpperCase().includes("COBRO")) && !notas.startsWith("COBRO|")) {
        // Reservado para evitar reimpresiones si se agrega automatización sobre finalizados
      }
    });
  }, [hybridPedidos, printConfig, sucursalConfig, terminalId]);

  return null;
}
