import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function getIngredientesForProducto(producto: any): Promise<string[]> {
    const ingredientesSet = new Set<string>();

    // 1. Recetas
    const { data: recetas } = await supabaseAdmin
        .from("recetas")
        .select("ingrediente:ingredientes(id, nombre)")
        .eq("producto_id", producto.id);

    if (recetas && recetas.length > 0) {
        for (const r of recetas as any[]) {
            if (r.ingrediente?.nombre) {
                ingredientesSet.add(r.ingrediente.nombre.trim());
            }
        }
    }

    // 2. Ficha técnica
    if (producto.ficha_tecnica_id) {
        const { data: fichaItems } = await supabaseAdmin
            .from("ficha_tecnica_items")
            .select("tipo, ingrediente:ingredientes(id, nombre), sub_ficha:fichas_tecnicas(id, nombre)")
            .eq("ficha_tecnica_id", producto.ficha_tecnica_id);

        if (fichaItems && fichaItems.length > 0) {
            for (const item of fichaItems as any[]) {
                if (item.ingrediente?.nombre) {
                    ingredientesSet.add(item.ingrediente.nombre.trim());
                } else if (item.sub_ficha?.nombre) {
                    ingredientesSet.add(item.sub_ficha.nombre.trim());
                }
            }
        }
    }

    // 3. Fallback en descripción
    if (ingredientesSet.size === 0 && producto.descripcion) {
        const desc = producto.descripcion.trim();
        const partes = desc.split(/[,;\n•\-\/]/).map((s: string) => s.trim()).filter((s: string) => s.length > 1);
        if (partes.length > 1) {
            partes.forEach((p: string) => ingredientesSet.add(p));
        } else if (desc.length > 0) {
            ingredientesSet.add(desc);
        }
    }

    return Array.from(ingredientesSet);
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const productoId = searchParams.get("producto_id");
        const productoIdsParam = searchParams.get("producto_ids");

        const ids: string[] = [];
        if (productoIdsParam) {
            ids.push(...productoIdsParam.split(",").map(id => id.trim()).filter(Boolean));
        } else if (productoId) {
            ids.push(productoId.trim());
        }

        if (ids.length === 0) {
            return NextResponse.json(
                { success: false, message: "producto_id o producto_ids es requerido" },
                { status: 400 }
            );
        }

        const { data: productos, error: prodError } = await supabaseAdmin
            .from("productos")
            .select("id, nombre, precio, descripcion, imagen_url, categoria_id, ficha_tecnica_id, sucursal_id")
            .in("id", ids);

        if (prodError || !productos || productos.length === 0) {
            return NextResponse.json(
                { success: false, message: "No se encontraron los productos especificados" },
                { status: 404 }
            );
        }

        const productosDetallados = await Promise.all(
            productos.map(async (prod) => {
                const ings = await getIngredientesForProducto(prod);
                return {
                    id: prod.id,
                    nombre: prod.nombre,
                    precio: prod.precio,
                    descripcion: prod.descripcion || "",
                    imagen_url: prod.imagen_url || "",
                    categoria_id: prod.categoria_id,
                    ingredientes: ings,
                    ingredientesTexto: ings.join(", "),
                };
            })
        );

        // Suma total de precios regulares
        const precioTotal = productosDetallados.reduce((sum, p) => sum + (p.precio || 0), 0);

        // Ingredientes combinados con formato descriptivo si son varios
        let ingredientesTextoCombinado = "";
        if (productosDetallados.length === 1) {
            ingredientesTextoCombinado = productosDetallados[0].ingredientesTexto;
        } else {
            ingredientesTextoCombinado = productosDetallados
                .map(p => `${p.nombre}: ${p.ingredientesTexto || p.descripcion || "delicioso"}`)
                .join(" | ");
        }

        const todosIngredientesSet = new Set<string>();
        productosDetallados.forEach(p => p.ingredientes.forEach(i => todosIngredientesSet.add(i)));

        return NextResponse.json({
            success: true,
            productos: productosDetallados,
            producto: productosDetallados[0],
            precioTotal,
            ingredientes: Array.from(todosIngredientesSet),
            ingredientesTexto: ingredientesTextoCombinado,
        });

    } catch (error: any) {
        console.error("Error en /api/marketing/product-details:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Error al obtener detalles de productos" },
            { status: 500 }
        );
    }
}
