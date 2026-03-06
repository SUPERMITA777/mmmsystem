import { supabase } from "./supabaseClient";

/**
 * Descuenta el stock de los ingredientes asociados a los productos de un pedido
 * según las recetas configuradas.
 */
export async function descontarStockDePedido(pedidoId: string, sucursalId: string) {
    console.log(`[STOCK] Iniciando descuento para pedido ${pedidoId} en sucursal ${sucursalId}`);
    try {
        // 1. Obtener items del pedido
        const { data: items, error: iError } = await supabase
            .from("pedido_items")
            .select("producto_id, cantidad")
            .eq("pedido_id", pedidoId);

        if (iError) {
            console.error("[STOCK] Error obteniendo items:", iError);
            return;
        }
        if (!items || items.length === 0) {
            console.warn("[STOCK] El pedido no tiene items");
            return;
        }

        for (const item of items) {
            // 2. Obtener receta del producto
            const { data: receta, error: rError } = await supabase
                .from("recetas")
                .select("ingrediente_id, cantidad")
                .eq("producto_id", item.producto_id);

            if (rError) {
                console.error(`[STOCK] Error obteniendo receta para producto ${item.producto_id}:`, rError);
                continue;
            }

            if (!receta || receta.length === 0) {
                console.log(`[STOCK] El producto ${item.producto_id} no tiene receta configurada`);
                continue;
            }

            for (const r of receta) {
                const cantidadADescontar = r.cantidad * item.cantidad;

                console.log(`[STOCK] Descontando ${cantidadADescontar} del ingrediente ${r.ingrediente_id}`);

                // 3. Registrar movimiento de salida tipo 'venta'
                // El trigger 'update_stock_on_movement_trigger' en la DB restará esto automáticamente
                const { error: mError } = await supabase.from("movimientos_stock").insert([{
                    sucursal_id: sucursalId,
                    ingrediente_id: r.ingrediente_id,
                    tipo: "venta",
                    cantidad: cantidadADescontar,
                    motivo: `Venta automática (Pedido #${pedidoId})`,
                    pedido_id: pedidoId
                }]);

                if (mError) {
                    console.error("[STOCK] Error insertando movimiento:", mError);
                }
            }
        }
        console.log(`[STOCK] Descuento completado para pedido ${pedidoId}`);
    } catch (e) {
        console.error("[STOCK] Error crítico en descontarStockDePedido:", e);
    }
}
