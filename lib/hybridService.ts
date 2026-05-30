import { supabase } from "./supabaseClient";
import { db, type PedidoLocal, marcarSincronizado } from "./db";
import { doBridgePost } from "./printUtils";

/**
 * Servicio híbrido para gestionar la persistencia y sincronización de pedidos.
 * Intenta Supabase -> Local Hub -> IndexedDB (Solo local).
 */
export async function persistirPedidoHibrido(
    pedidoPayload: any, 
    itemsPayload: any[], 
    bridgeIp: string = "127.0.0.1",
    sucursalId: string
) {
    const localId = pedidoPayload.id || crypto.randomUUID();
    
    // 1. Siempre guardar en IndexedDB primero (Respaldo total)
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

    // 2. Intentar Supabase (Cloud)
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
                variante_id: it.variante_id || null,
                variante_nombre: it.variante_nombre || null,
                cantidad: it.cantidad,
                precio_unitario: it.precio_unitario,
                descuento: it.descuento || 0,
                notas: it.notas || "",
                adicionales: it.adicionales || [],
                estado: it.estado || "pendiente"
            }));
            const { error: iError } = await supabase.from("pedido_items").upsert(items);
            if (iError) throw iError;

            // Éxito en Supabase
            await marcarSincronizado(localId);
            console.log("[Hybrid] Sincronizado con Supabase OK");
            return { success: true, source: "supabase" };
        } catch (err) {
            console.warn("[Hybrid] Fallo Supabase, intentando Local Hub...", err);
        }
    }

    // 3. Fallback a Local Hub (LAN)
    try {
        const res = await doBridgePost("/api/save-order", {
            pedido: pedidoPayload,
            items: itemsPayload,
            tenantId: sucursalId
        }, bridgeIp);
        
        if (res && res.success) {
            // El Local Hub se encargará de subirlo a Supabase después
            // Lo marcamos como sincronizado en el cliente para no duplicar
            await marcarSincronizado(localId);
            console.log("[Hybrid] Sincronizado con Local Hub OK");
            return { success: true, source: "bridge" };
        }
    } catch (err) {
        console.warn("[Hybrid] Fallo Local Hub, queda en IndexedDB para luego", err);
    }

    // Si llegamos acá, solo quedó en IndexedDB
    return { success: true, source: "local" };
}
