import { supabase } from "./supabaseClient";
import { db, marcarSincronizado } from "./db";

/**
 * Servicio híbrido para gestionar la persistencia de pedidos.
 * Flujo: IndexedDB (respaldo local) → Supabase (cloud).
 *
 * El bridge de impresión ya NO participa en la persistencia de pedidos —
 * solo se usa para enviar trabajos de impresión. Toda la lógica de
 * persistencia offline queda cubierta por IndexedDB + sync background.
 */
export async function persistirPedidoHibrido(
    pedidoPayload: any,
    itemsPayload: any[],
    bridgeIp: string = "127.0.0.1", // Mantenido por compatibilidad de firma, ya no se usa aquí
    sucursalId: string
) {
    const localId = pedidoPayload.id || crypto.randomUUID();

    // 1. Siempre guardar en IndexedDB primero (respaldo total, funciona offline)
    await db.pedidos.put({
        id: localId,
        mesa: pedidoPayload.mesa_id || null,
        items: itemsPayload,
        total: pedidoPayload.total,
        estado: pedidoPayload.estado || "pendiente",
        sucursal_id: sucursalId,
        payload_pedido: pedidoPayload,
        payload_items: itemsPayload,
        sincronizado: false,
        intentos_sync: 0,
        created_at: new Date().toISOString()
    } as any);

    // 2. Intentar sincronizar con Supabase (requiere internet)
    if (navigator.onLine) {
        try {
            const { error: pError } = await supabase.from("pedidos").upsert({
                ...pedidoPayload,
                id: localId
            });
            if (pError) throw pError;

            const items = itemsPayload.map(it => ({
                id: it.id || crypto.randomUUID(),
                pedido_id: localId,
                producto_id: it.producto_id,
                nombre_producto: it.nombre_producto,
                cantidad: it.cantidad,
                precio_unitario: it.precio_unitario,
                descuento: it.descuento || 0,
                notas: it.notas || "",
                adicionales: it.adicionales || [],
                estado: it.estado || "pendiente"
            }));
            const { error: iError } = await supabase.from("pedido_items").upsert(items);
            if (iError) throw iError;

            await marcarSincronizado(localId);
            console.log("[Hybrid] Sincronizado con Supabase OK");
            return { success: true, source: "supabase" };
        } catch (err) {
            console.warn("[Hybrid] Fallo Supabase, pedido guardado en IndexedDB para sync posterior:", err);
        }
    }

    // Sin internet o Supabase falló → quedó en IndexedDB, se sincronizará automáticamente
    // cuando se recupere la conexión via el hook useHybridPedidos
    return { success: true, source: "local" };
}
