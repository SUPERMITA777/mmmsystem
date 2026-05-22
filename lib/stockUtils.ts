import { supabase } from "./supabaseClient";

/**
 * Resuelve de forma recursiva todos los ingredientes que deben descontarse para una ficha técnica,
 * incluyendo el desglose de sub-recetas si las hubiera.
 */
async function obtenerIngredientesDeFicha(fichaId: string, cantidadMultiplicador: number): Promise<{ ingrediente_id: string; cantidad: number }[]> {
    const { data: items, error } = await supabase
        .from("ficha_tecnica_items")
        .select("ingrediente_id, cantidad, tipo, sub_ficha_id")
        .eq("ficha_tecnica_id", fichaId);

    if (error || !items) {
        console.error(`[STOCK] Error obteniendo items de ficha técnica ${fichaId}:`, error);
        return [];
    }

    const ingredientesADescontar: { ingrediente_id: string; cantidad: number }[] = [];

    for (const item of items) {
        const cantidadTotal = Number(item.cantidad) * cantidadMultiplicador;
        if (item.tipo === "ingrediente" && item.ingrediente_id) {
            ingredientesADescontar.push({
                ingrediente_id: item.ingrediente_id,
                cantidad: cantidadTotal
            });
        } else if (item.tipo === "sub_receta" && item.sub_ficha_id) {
            // Resolver sub-receta de forma recursiva
            const subIngredientes = await obtenerIngredientesDeFicha(item.sub_ficha_id, cantidadTotal);
            ingredientesADescontar.push(...subIngredientes);
        }
    }

    return ingredientesADescontar;
}

/**
 * Descuenta el stock de los ingredientes asociados a los productos de un pedido
 * según las fichas técnicas y recetas configuradas.
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
            // 2. Obtener la ficha técnica asignada al producto en la tabla productos
            const { data: producto, error: pError } = await supabase
                .from("productos")
                .select("ficha_tecnica_id")
                .eq("id", item.producto_id)
                .single();

            if (pError) {
                console.error(`[STOCK] Error obteniendo producto ${item.producto_id}:`, pError);
                continue;
            }

            if (!producto || !producto.ficha_tecnica_id) {
                console.log(`[STOCK] El producto ${item.producto_id} no tiene ficha técnica configurada`);
                continue;
            }

            // 3. Obtener ingredientes a descontar (resolviendo sub-recetas de forma recursiva)
            const ingredientes = await obtenerIngredientesDeFicha(producto.ficha_tecnica_id, item.cantidad);

            for (const ing of ingredientes) {
                console.log(`[STOCK] Descontando ${ing.cantidad} del ingrediente ${ing.ingrediente_id}`);

                // 4. Registrar movimiento de salida tipo 'venta'
                // El trigger 'update_stock_on_movement_trigger' en la DB restará esto automáticamente
                const { error: mError } = await supabase.from("movimientos_stock").insert([{
                    sucursal_id: sucursalId,
                    ingrediente_id: ing.ingrediente_id,
                    tipo: "venta",
                    cantidad: ing.cantidad,
                    motivo: `Venta automática (Pedido #${pedidoId})`,
                    pedido_id: pedidoId
                }]);

                if (mError) {
                    console.error("[STOCK] Error insertando movimiento de stock:", mError);
                }
            }
        }
        console.log(`[STOCK] Descuento completado para pedido ${pedidoId}`);
    } catch (e) {
        console.error("[STOCK] Error crítico en descontarStockDePedido:", e);
    }
}

