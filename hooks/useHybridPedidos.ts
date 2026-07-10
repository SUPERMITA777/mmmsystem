import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { db } from "@/lib/db";

/**
 * Hook para obtener y unificar pedidos desde dos orígenes (Supabase + IndexedDB local).
 * 1. Nube: Consulta la tabla `pedidos` en Supabase (requiere internet).
 * 2. Almacenamiento Local (Dexie): Mezcla los pedidos pendientes aún no sincronizados.
 *
 * El bridge de impresión ya NO se usa para obtener pedidos — solo para imprimir.
 *
 * @param {string|null} sucursalId - El UUID de la sucursal activa.
 * @param {string} [bridgeIp="127.0.0.1"] - IP del bridge (mantenido por compatibilidad, solo se usa para impresión).
 */
export function useHybridPedidos(sucursalId: string | null, bridgeIp: string = "127.0.0.1") {

    const [pedidos, setPedidos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastSyncSource, setLastSyncSource] = useState<"supabase" | "local">("local");

    const fetchPedidos = useCallback(async () => {
        if (!sucursalId) return;

        let remotePedidos: any[] = [];
        let source: "supabase" | "bridge" | "local" = "local";

        // 1. Intentar Supabase
        if (navigator.onLine) {
            try {
                const { data, error } = await supabase
                    .from("pedidos")
                    .select(`
                        id,
                        mesa_id,
                        sucursal_id,
                        camarero_id,
                        metodo_pago_id,
                        metodo_pago_nombre,
                        estado,
                        total,
                        subtotal,
                        costo_envio,
                        propina,
                        recargo,
                        cubierto_total,
                        comensales,
                        descuento,
                        origen,
                        notas,
                        notas_internas,
                        terminal_id,
                        created_at,
                        pago_confirmado,
                        repartidor_id,
                        tiempo_preparacion_minutos,
                        pedido_items (
                            id,
                            pedido_id,
                            producto_id,
                            nombre_producto,
                            cantidad,
                            precio_unitario,
                            descuento,
                            notas,
                            estado,
                            adicionales,
                            productos (
                                id,
                                nombre,
                                categoria_id,
                                impresora,
                                categorias (
                                    nombre
                                )
                            )
                        ),
                        mesas (
                            numero
                        ),
                        camarero:usuarios!camarero_id (
                            color
                        )
                    `)
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

        // 2. Si Supabase falló o no hay internet, los pedidos locales de Dexie
        // actuarán como respaldo (se combinan abajo).

        // 3. Obtener pedidos locales de Dexie (que aún no se sincronizaron)
        const localPendientes = await db.pedidos.where("sincronizado").equals(0).toArray();
        const localPayloads = await Promise.all(localPendientes.map(async p => {
            const itemsWithProd = await Promise.all((p.payload_items || []).map(async (item: any) => {
                const dbProd = await db.productos.get(item.producto_id);
                let dbCat = null;
                if (dbProd?.categoria_id) {
                    dbCat = await db.categorias.get(dbProd.categoria_id);
                }
                return {
                    ...item,
                    productos: dbProd ? {
                        ...dbProd,
                        categorias: dbCat ? { nombre: dbCat.nombre } : undefined
                    } : undefined
                };
            }));
            return {
                ...p.payload_pedido,
                pedido_items: itemsWithProd,
                is_local_only: true
            };
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
        // Polling de respaldo muy infrecuente (2 minutos) ya que usamos Realtime en los paneles principales
        const timer = setInterval(fetchPedidos, 120000);
        return () => clearInterval(timer);
    }, [fetchPedidos]);

    return { pedidos, loading, lastSyncSource, refresh: fetchPedidos };
}
