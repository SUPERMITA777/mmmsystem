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
  const autoPrintedItemIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef<boolean>(true);
  const printedPrecuentasRef = useRef<Map<string, string>>(new Map());

  // Loop de Impresión Automática
  useEffect(() => {
    if (!hybridPedidos || hybridPedidos.length === 0 || !printConfig) return;

    if (isFirstLoadRef.current) {
      // Marcar ítems existentes de más de 2 minutos para evitar reimpresión al iniciar sesión
      const dosMinutosAtras = new Date(Date.now() - 2 * 60 * 1000);
      hybridPedidos.forEach(p => {
        const items = p.pedido_items || [];
        items.forEach((it: any) => {
          const itemCreatedAt = it.created_at ? new Date(it.created_at) : new Date(p.created_at);
          if (itemCreatedAt < dosMinutosAtras) {
            autoPrintedItemIdsRef.current.add(it.id);
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
      isFirstLoadRef.current = false;
      console.log("[GlobalAutoPrint] Inicializado listado de pedidos impresos. Viejos ignorados:", autoPrintedIdsRef.current.size);
    }

    const autoPrintEnabled = sucursalConfig?.panel_settings?.imprimir_al_recibir !== false;

    hybridPedidos.forEach((pedido) => {
      // Ruteo de terminal si el pedido es del POS
      const pedTerminal = pedido.terminal_id ? String(pedido.terminal_id).trim() : "";
      const isPosOrder = pedido.origen === "pos";
      
      if (isPosOrder && pedTerminal && pedTerminal !== "null" && pedTerminal !== "undefined" && pedTerminal !== String(terminalId)) {
        return;
      }

      // 1. Auto-impresión de comanda de cocina para nuevos ítems
      if (autoPrintEnabled && ["pendiente", "confirmado", "preparando"].includes(pedido.estado)) {
        const allItems = pedido.pedido_items || [];
        if (allItems.length > 0) {
          const newItemsToPrint = allItems.filter((item: any) => !autoPrintedItemIdsRef.current.has(item.id));
          if (newItemsToPrint.length > 0) {
            console.log(`[GlobalAutoPrint] Detectados ${newItemsToPrint.length} ítems nuevos en pedido:`, pedido.numero_pedido);
            newItemsToPrint.forEach((item: any) => autoPrintedItemIdsRef.current.add(item.id));
            autoPrintedIdsRef.current.add(pedido.id);

            try {
              printCocina(pedido, printConfig, newItemsToPrint);
            } catch (err) {
              console.error("[GlobalAutoPrint] Error al imprimir cocina automáticamente:", err);
            }
          }
        }
      }

      // 2. Auto-impresión de Pre-cuenta solicitada desde celulares
      const notas = pedido.notas_internas || "";
      if (notas.toUpperCase().includes("PRECUENTA")) {
        const lastPrintedValue = printedPrecuentasRef.current.get(pedido.id);
        if (lastPrintedValue !== notas) {
          console.log(`[GlobalAutoPrint] Solicitud de Pre-Cuenta detectada para pedido:`, pedido.numero_pedido);
          printedPrecuentasRef.current.set(pedido.id, notas);
          
          if (pedido.metodo_pago_id) {
            printPreCuenta(pedido, printConfig);
          }
        }
      }
    });
  }, [hybridPedidos, printConfig, sucursalConfig, terminalId]);

  return null;
}
