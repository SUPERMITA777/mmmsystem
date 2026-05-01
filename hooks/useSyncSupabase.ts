"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  db,
  getPedidosPendientes,
  marcarSincronizado,
  registrarFalloSync,
  contarPendientes,
  type PedidoLocal,
} from "@/lib/db";

/**
 * ═══════════════════════════════════════════════════════════
 *  useSyncSupabase — Hook de Sincronización Local → Cloud
 * ═══════════════════════════════════════════════════════════
 *
 *  Detecta el estado de conexión y sincroniza automáticamente
 *  los pedidos pendientes en Dexie con la tabla `pedidos` en
 *  Supabase cuando se recupera la conexión.
 *
 *  Características:
 *  - Detección en tiempo real de online/offline
 *  - Sincronización automática al reconectarse
 *  - Sincronización periódica cada 30s como respaldo
 *  - Inserción masiva con manejo de colisiones UUID
 *  - Exponential backoff en caso de fallos repetidos
 *  - Contador en tiempo real de registros pendientes
 */

interface SyncState {
  /** ¿Hay conexión a internet? */
  isOnline: boolean;
  /** ¿Se está ejecutando la sincronización en este momento? */
  isSyncing: boolean;
  /** Cantidad de pedidos locales pendientes de sincronizar */
  pendingCount: number;
  /** Último timestamp de sincronización exitosa */
  lastSyncAt: string | null;
  /** Último error de sincronización */
  lastError: string | null;
  /** Forzar sincronización manual */
  forceSync: () => Promise<void>;
}

const SYNC_INTERVAL_MS = 30_000; // 30 segundos
const MAX_BATCH_SIZE = 50; // Máximo de registros por batch

export function useSyncSupabase(sucursalId: string | null): SyncState {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const isSyncingRef = useRef(false);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Actualizar contador de pendientes ──────────────────

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await contarPendientes(sucursalId || undefined);
      setPendingCount(count);
    } catch {
      // Silenciar errores de IndexedDB
    }
  }, [sucursalId]);

  // ─── Sincronizar un pedido individual ───────────────────

  const syncPedido = useCallback(
    async (pedido: PedidoLocal): Promise<boolean> => {
      try {
        // 1. Insertar el pedido en la tabla `pedidos` de Supabase
        //    Usar el ID local como ID de Supabase (UUID)
        const payload: Record<string, any> = {
          ...pedido.payload_pedido,
          id: pedido.id, // Usar el UUID local
        };

        const { data: insertedPedido, error: pedidoError } = await supabase
          .from("pedidos")
          .upsert(payload, { onConflict: "id" })
          .select("id")
          .single();

        if (pedidoError) {
          // Si es colisión de numero_pedido (unique constraint), intentar con nuevo número
          if (pedidoError.code === "23505" && pedidoError.message?.includes("numero_pedido")) {
            console.warn(`[Sync] Colisión de numero_pedido para ${pedido.id}, regenerando...`);
            // Generar nuevo número de pedido con sufijo de resync
            const newPayload = {
              ...payload,
              numero_pedido: `${payload.numero_pedido}-RS${Date.now().toString(36)}`,
            };
            const { error: retryError } = await supabase
              .from("pedidos")
              .upsert(newPayload, { onConflict: "id" })
              .select("id")
              .single();

            if (retryError) throw retryError;
          } else {
            throw pedidoError;
          }
        }

        // 2. Insertar los items del pedido
        if (pedido.payload_items && pedido.payload_items.length > 0) {
          const itemsPayload = pedido.payload_items.map((item) => ({
            ...item,
            pedido_id: pedido.id,
          }));

          const { error: itemsError } = await supabase
            .from("pedido_items")
            .upsert(itemsPayload, { onConflict: "id" })
            .select();

          if (itemsError) {
            console.error(`[Sync] Error insertando items para pedido ${pedido.id}:`, itemsError);
            // No fallar el pedido completo por items, marcar igualmente
          }
        }

        // 3. Marcar como sincronizado en Dexie
        await marcarSincronizado(pedido.id);
        return true;
      } catch (error: any) {
        console.error(`[Sync] Error sincronizando pedido ${pedido.id}:`, error);
        await registrarFalloSync(pedido.id, error.message || "Error desconocido");
        return false;
      }
    },
    []
  );

  // ─── Proceso de sincronización masiva ───────────────────

  // ─── Sincronizar catálogo (Supabase → Dexie) ───────────

  const syncCatalog = useCallback(async () => {
    if (!sucursalId || !navigator.onLine) return;

    try {
      console.log("[Sync] Actualizando catálogo local...");

      // Tablas a sincronizar
      const tables = [
        "productos",
        "categorias",
        "metodos_pago",
        "adicionales",
        "grupos_adicionales",
        "producto_grupos_adicionales",
        "descuentos",
        "mesas",
        "fichas_tecnicas",
        "ficha_tecnica_items",
        "ingredientes",
      ];

      for (const table of tables) {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .eq("sucursal_id", sucursalId);

        if (!error && data) {
          // Limpiar y re-insertar para mantener consistencia
          await (db as any)[table].clear();
          await (db as any)[table].bulkAdd(data);
        }
      }

      // Caso especial: config_sucursal (single record)
      const { data: config, error: configError } = await supabase
        .from("config_sucursal")
        .select("*")
        .eq("sucursal_id", sucursalId)
        .maybeSingle();

      if (!configError && config) {
        await db.config_sucursal.put(config);
      }

      console.log("[Sync] Catálogo local actualizado correctamente.");
    } catch (err) {
      console.error("[Sync] Error actualizando catálogo:", err);
    }
  }, [sucursalId]);

  const syncAll = useCallback(async () => {
    if (!sucursalId) return;
    if (isSyncingRef.current) return; // Evitar concurrencia
    if (!navigator.onLine) return;

    isSyncingRef.current = true;
    setIsSyncing(true);
    setLastError(null);

    try {
      // Primero asegurar que el catálogo esté al día
      await syncCatalog();

      const pendientes = await getPedidosPendientes(sucursalId);

      if (pendientes.length === 0) {
        setIsSyncing(false);
        isSyncingRef.current = false;
        return;
      }

      console.log(`[Sync] Sincronizando ${pendientes.length} pedidos pendientes...`);

      // Procesar en batches para no saturar la conexión
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < pendientes.length; i += MAX_BATCH_SIZE) {
        const batch = pendientes.slice(i, i + MAX_BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map((pedido) => syncPedido(pedido))
        );

        results.forEach((result) => {
          if (result.status === "fulfilled" && result.value) {
            successCount++;
          } else {
            failCount++;
          }
        });
      }

      console.log(
        `[Sync] Completado: ${successCount} OK, ${failCount} fallidos de ${pendientes.length} total`
      );

      if (failCount > 0) {
        setLastError(`${failCount} pedido(s) no pudieron sincronizarse`);
      }

      if (successCount > 0) {
        setLastSyncAt(new Date().toISOString());
      }
    } catch (error: any) {
      console.error("[Sync] Error general:", error);
      setLastError(error.message || "Error de sincronización");
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
      await refreshPendingCount();
    }
  }, [sucursalId, syncPedido, refreshPendingCount]);

  // ─── Listeners de conexión ──────────────────────────────

  useEffect(() => {
    // Inicializar estado real al montar
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      console.log("[Sync] 🟢 Conexión recuperada");
      setIsOnline(true);
      // Intentar sync inmediatamente al reconectarse
      syncCatalog();
      syncAll();
    };

    const handleOffline = () => {
      console.log("[Sync] 🔴 Sin conexión");
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncAll]);

  // ─── Sincronización periódica ───────────────────────────

  useEffect(() => {
    // Sync inicial
    refreshPendingCount();
    if (navigator.onLine && sucursalId) {
      syncAll();
    }

    // Sync periódico
    syncIntervalRef.current = setInterval(() => {
      if (navigator.onLine && sucursalId) {
        syncAll();
      }
      refreshPendingCount();
    }, SYNC_INTERVAL_MS);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [sucursalId, syncAll, refreshPendingCount]);

  // ─── Listener de cambios en Dexie ──────────────────────

  useEffect(() => {
    // Escuchar cambios en la tabla de pedidos para actualizar el contador
    const handler = () => {
      setTimeout(refreshPendingCount, 100);
    };
    db.pedidos.hook("creating", handler);

    return () => {
      db.pedidos.hook("creating").unsubscribe(handler);
    };
  }, [refreshPendingCount]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncAt,
    lastError,
    forceSync: syncAll,
  };
}
