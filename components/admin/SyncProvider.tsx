"use client";

import { useSyncSupabase } from "@/hooks/useSyncSupabase";
import { useTenant } from "@/context/TenantContext";
import OfflineIndicator from "@/components/ui/OfflineIndicator";

/**
 * SyncProvider — Componente cliente que integra el hook de sincronización
 * y el indicador visual de estado offline en el layout del admin.
 * 
 * Se monta una sola vez en el layout y gestiona la sincronización
 * automática de pedidos locales con Supabase.
 */
export default function SyncProvider() {
  const { sucursalId } = useTenant();
  const sync = useSyncSupabase(sucursalId);

  return (
    <OfflineIndicator
      isOnline={sync.isOnline}
      isSyncing={sync.isSyncing}
      pendingCount={sync.pendingCount}
      lastSyncAt={sync.lastSyncAt}
      lastError={sync.lastError}
      onForceSync={sync.forceSync}
    />
  );
}
