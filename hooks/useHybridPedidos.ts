import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { db } from "@/lib/db";
import { doBridgePost } from "@/lib/printUtils";

export function useHybridPedidos(sucursalId: string | null, bridgeIp: string = "127.0.0.1") {
    const [pedidos, setPedidos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastSyncSource, setLastSyncSource] = useState<"supabase" | "bridge" | "local">("local");

    const fetchPedidos = useCallback(async () => {
        if (!sucursalId) return;

        let remotePedidos: any[] = [];
        let source: "supabase" | "bridge" | "local" = "local";

        // 1. Intentar Supabase
        if (navigator.onLine) {
            try {
                const { data, error } = await supabase
                    .from("pedidos")
                    .select("*, pedido_items(*, productos(id, nombre, categoria_id, impresora, categorias(nombre))), mesas(numero), camarero:usuarios!camarero_id(color)")
                    .eq("sucursal_id", sucursalId)
                    .in("estado", ["pendiente", "confirmado", "preparando", "listo", "en_camino"])
                    .order("created_at", { ascending: false });

                if (!error && data) {
                    remotePedidos = data;
                    source = "supabase";
                } else {
                    throw error;
                }
            } catch (err) {
                console.warn("[HybridHook] Supabase falló, intentando Bridge...", err);
            }
        }

        // 2. Si Supabase falló o no hay internet, intentar Local Hub (Bridge)
        if (source === "local") {
            try {
                // El bridge devuelve lo que tiene en su JSON local
                const res = await fetch(`http://${bridgeIp}:9100/api/get-orders`, {
                    headers: { 'X-Tenant-ID': sucursalId }
                });
                if (res.ok) {
                    const data = await res.json();
                    // Normalizar formato si es necesario (el bridge guarda el payload completo)
                    remotePedidos = data.map((o: any) => o.pedido || o); 
                    source = "bridge";
                }
            } catch (err) {
                console.warn("[HybridHook] Bridge falló, usando solo local", err);
            }
        }

        // 3. Obtener pedidos locales de Dexie (que aún no se sincronizaron)
        const localPendientes = await db.pedidos.where("sincronizado").equals(0).toArray();
        const localPayloads = localPendientes.map(p => ({
            ...p.payload_pedido,
            pedido_items: p.payload_items,
            is_local_only: true
        }));

        // 4. Combinar y de-duplicar por ID
        const combined = [...localPayloads];
        
        remotePedidos.forEach(rp => {
            if (!combined.some((cp: any) => cp.id === rp.id)) {
                combined.push(rp);
            }
        });

        // Ordenar por fecha
        combined.sort((a: any, b: any) => new Date(b.created_at || b.created_at_local || 0).getTime() - new Date(a.created_at || a.created_at_local || 0).getTime());

        setPedidos(combined);
        setLastSyncSource(source);
        setLoading(false);
    }, [sucursalId, bridgeIp]);

    useEffect(() => {
        fetchPedidos();
        const timer = setInterval(fetchPedidos, 15000);
        return () => clearInterval(timer);
    }, [fetchPedidos]);

    return { pedidos, loading, lastSyncSource, refresh: fetchPedidos };
}
