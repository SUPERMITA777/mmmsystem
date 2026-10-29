import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sucursal_id, productos } = body;

    if (!sucursal_id) {
      return NextResponse.json({ success: false, error: "Falta sucursal_id" }, { status: 400 });
    }

    if (!productos || !Array.isArray(productos) || productos.length === 0) {
      return NextResponse.json({ success: false, error: "No se recibieron productos para sincronizar" }, { status: 400 });
    }

    // 1. Buscar o crear la categoría 'PedidosYa' para esta sucursal
    let categoriaId: string | null = null;
    const { data: cats } = await supabaseAdmin
      .from("categorias")
      .select("id")
      .eq("sucursal_id", sucursal_id)
      .eq("nombre", "PedidosYa")
      .maybeSingle();

    if (cats?.id) {
      categoriaId = cats.id;
    } else {
      const { data: newCat, error: errNewCat } = await supabaseAdmin
        .from("categorias")
        .insert({
          sucursal_id,
          nombre: "PedidosYa",
          descripcion: "Catálogo sincronizado desde PedidosYa (Oculto en menú público)",
          activo: true,
          orden: 99
        })
        .select("id")
        .single();

      if (errNewCat) {
        throw new Error(`Error creando categoría PedidosYa: ${errNewCat.message}`);
      }
      categoriaId = newCat.id;
    }

    // 2. Traer productos existentes de la sucursal para verificar duplicados
    const { data: existingProds } = await supabaseAdmin
      .from("productos")
      .select("id, nombre, precio, descripcion, categoria_id, imagen_url")
      .eq("sucursal_id", sucursal_id);

    const prodsByName = new Map<string, any>();
    (existingProds || []).forEach(p => {
      prodsByName.set(p.nombre.trim().toLowerCase(), p);
    });

    let creados = 0;
    let actualizados = 0;

    for (const item of productos) {
      const nombre = (item.nombre || item.name || "").trim();
      if (!nombre) continue;

      const precio = parseFloat(item.precio || item.price || 0);
      const descripcion = item.descripcion || item.description || "Producto sincronizado de PedidosYa";
      const imagenUrl = item.imagen_url || item.imageUrl || item.image || "";
      const idPy = item.id_py || item.id || "";

      const key = nombre.toLowerCase();
      let existing = prodsByName.get(key);
      if (!existing && idPy) {
        existing = (existingProds || []).find(p => p.descripcion?.includes(`ID PY: ${idPy}`));
      }

      if (existing) {
        // Actualizar precio y asegurar que esté disponible para administración pero oculto al cliente
        const updateFields: any = {
          descripcion: descripcion || existing.descripcion,
          imagen_url: imagenUrl || existing.imagen_url,
          visible_en_menu: false,
          producto_oculto: true,
          activo: true,
          updated_at: new Date().toISOString()
        };

        if (precio > 0) {
          updateFields.precio = precio;
        }

        await supabaseAdmin
          .from("productos")
          .update(updateFields)
          .eq("id", existing.id);

        actualizados++;
      } else {
        // Insertar nuevo producto
        const nuevo = {
          sucursal_id,
          categoria_id: categoriaId,
          nombre,
          nombre_interno: `[PY] ${nombre}`,
          descripcion: idPy ? `${descripcion} (ID PY: ${idPy})` : descripcion,
          precio,
          costo_fijo: 0,
          stock_actual: 0,
          stock_minimo: 0,
          control_stock: false,
          visible_en_menu: false, // 🔒 Oculto para clientes en carta pública
          producto_oculto: true,  // 🔒 Oculto en menú público
          activo: true,          // ✅ Activo para administración, POS y métricas
          imagen_url: imagenUrl,
          orden: 99
        };

        const { data: inserted, error: insErr } = await supabaseAdmin
          .from("productos")
          .insert(nuevo)
          .select("id")
          .single();

        if (!insErr && inserted) {
          prodsByName.set(key, { id: inserted.id, nombre, precio });
          creados++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      categoria: "PedidosYa",
      creados,
      actualizados,
      total: creados + actualizados
    });

  } catch (error: any) {
    console.error("Error sincronizando catálogo de PedidosYa:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sucursalId = searchParams.get("sucursal_id");
    if (!sucursalId) {
      return NextResponse.json({ success: false, error: "Falta sucursal_id" }, { status: 400 });
    }

    const { data: cat } = await supabaseAdmin
      .from("categorias")
      .select("id")
      .eq("sucursal_id", sucursalId)
      .eq("nombre", "PedidosYa")
      .maybeSingle();

    if (!cat) {
      return NextResponse.json({ success: true, count: 0, productos: [] });
    }

    const { data: prods, count } = await supabaseAdmin
      .from("productos")
      .select("id, nombre, precio, visible_en_menu, producto_oculto, activo", { count: "exact" })
      .eq("sucursal_id", sucursalId)
      .eq("categoria_id", cat.id);

    return NextResponse.json({
      success: true,
      categoriaId: cat.id,
      count: count || prods?.length || 0,
      productos: prods || []
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
