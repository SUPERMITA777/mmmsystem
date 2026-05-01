"use client";

import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw, Check, AlertTriangle } from "lucide-react";

/**
 * ═══════════════════════════════════════════════════════════
 *  OfflineIndicator — Indicador Visual de Estado de Red
 * ═══════════════════════════════════════════════════════════
 *
 *  Muestra un badge flotante con:
 *  - Estado de conexión (online/offline)
 *  - Cantidad de registros pendientes de sincronizar
 *  - Botón para forzar sincronización manual
 *  - Animación de sync en progreso
 */

interface OfflineIndicatorProps {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  lastError: string | null;
  onForceSync: () => void;
}

export default function OfflineIndicator({
  isOnline,
  isSyncing,
  pendingCount,
  lastSyncAt,
  lastError,
  onForceSync,
}: OfflineIndicatorProps) {
  // Si todo está sincronizado y online, mostrar indicador mínimo
  const isAllGood = isOnline && pendingCount === 0 && !isSyncing;

  return (
    <div
      className={`
        fixed bottom-4 right-4 z-[200] 
        flex items-center gap-2.5 
        px-4 py-2.5 rounded-2xl 
        shadow-lg border backdrop-blur-xl 
        transition-all duration-500 ease-out
        ${
          !isOnline
            ? "bg-red-950/90 border-red-500/40 shadow-red-500/20 text-red-100"
            : pendingCount > 0
            ? "bg-amber-950/90 border-amber-500/40 shadow-amber-500/20 text-amber-100"
            : isSyncing
            ? "bg-blue-950/90 border-blue-500/40 shadow-blue-500/20 text-blue-100"
            : "bg-emerald-950/80 border-emerald-500/30 shadow-emerald-500/10 text-emerald-200"
        }
      `}
    >
      {/* ─── Ícono de estado ─── */}
      <div className="relative">
        {!isOnline ? (
          <WifiOff size={16} className="text-red-400" />
        ) : isSyncing ? (
          <RefreshCw size={16} className="text-blue-400 animate-spin" />
        ) : pendingCount > 0 ? (
          <CloudOff size={16} className="text-amber-400" />
        ) : (
          <Cloud size={16} className="text-emerald-400" />
        )}

        {/* Punto de pulso para offline */}
        {!isOnline && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        )}
      </div>

      {/* ─── Texto de estado ─── */}
      <div className="flex flex-col">
        <span className="text-[11px] font-bold tracking-wide uppercase">
          {!isOnline
            ? "Modo Offline"
            : isSyncing
            ? "Sincronizando..."
            : pendingCount > 0
            ? "Pendientes"
            : "Conectado"}
        </span>

        {pendingCount > 0 && (
          <span className="text-[10px] opacity-70 font-medium">
            {pendingCount} registro{pendingCount !== 1 ? "s" : ""} por sincronizar
          </span>
        )}

        {lastError && !isSyncing && (
          <span className="text-[9px] text-red-400 flex items-center gap-1 mt-0.5">
            <AlertTriangle size={9} />
            {lastError}
          </span>
        )}
      </div>

      {/* ─── Badge de conteo ─── */}
      {pendingCount > 0 && (
        <span
          className={`
            min-w-[22px] h-[22px] flex items-center justify-center 
            rounded-full text-[10px] font-black
            ${
              !isOnline
                ? "bg-red-500/30 text-red-200"
                : "bg-amber-500/30 text-amber-200"
            }
          `}
        >
          {pendingCount}
        </span>
      )}

      {/* ─── Botón de sync manual ─── */}
      {isOnline && pendingCount > 0 && !isSyncing && (
        <button
          onClick={onForceSync}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors active:scale-90"
          title="Forzar sincronización"
        >
          <RefreshCw size={13} />
        </button>
      )}

      {/* ─── Check si todo está bien ─── */}
      {isAllGood && (
        <Check size={14} className="text-emerald-400" />
      )}
    </div>
  );
}
