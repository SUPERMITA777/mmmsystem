import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const productoId = searchParams.get("producto_id");

        if (!productoId) {
            return NextResponse.json(
                { success: false, message: "producto_id es requerido" },
                { status: 400 }
            );
        }

        // 1. Obtener datos del producto
        const { data: producto, error: prodError } = await supabaseAdmin
            .from("productos")
            .select("id, nombre, precio, descripcion, imagen_url, categoria_id, ficha_tecnica_id, sucursal_id")
            .eq("id", productoId)
            .single();

        if (prodError || !producto) {
            return NextResponse.json(
                { success: false, message: "Producto no encontrado" },
                { status: 404 }
            );
        }

        const ingredientesSet = new Set<string>();

        // 2. Buscar en tabla 'recetas'
        const { data: recetas } = await supabaseAdmin
            .from("recetas")
            .select("ingrediente:ingredientes(id, nombre)")
            .eq("producto_id", productoId);

        if (recetas && recetas.length > 0) {
            for (const r of recetas as any[]) {
                if (r.ingrediente?.nombre) {
                    ingredientesSet.add(r.ingrediente.nombre.trim());
                }
            }
        }

        // 3. Buscar en 'ficha_tecnica_items' si el producto tiene ficha técnica
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

        // 4. Si no encontramos ingredientes en tablas formales, extraer de la descripción si existe
        if (ingredientesSet.size === 0 && producto.descripcion) {
            const desc = producto.descripcion.trim();
            // Si la descripción está separada por comas o guiones
            const partes = desc.split(/[,;\n•\-\/]/).map((s: string) => s.trim()).filter((s: string) => s.length > 1);
            if (partes.length > 1) {
                partes.forEach((p: string) => ingredientesSet.add(p));
            } else if (desc.length > 0) {
                ingredientesSet.add(desc);
            }
        }

        const ingredientesLista = Array.from(ingredientesSet);
        const ingredientesTexto = ingredientesLista.join(", ");

        return NextResponse.json({
            success: true,
            producto: {
                id: producto.id,
                nombre: producto.nombre,
                precio: producto.precio,
                descripcion: producto.descripcion || "",
                imagen_url: producto.imagen_url || "",
                categoria_id: producto.categoria_id,
            },
            ingredientes: ingredientesLista,
            ingredientesTexto: ingredientesTexto,
        });

    } catch (error: any) {
        console.error("Error en /api/marketing/product-details:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Error al obtener detalles del producto" },
            { status: 500 }
        );
    }
}
