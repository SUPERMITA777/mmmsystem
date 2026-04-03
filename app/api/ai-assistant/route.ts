import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseCommand, describeCommand, type ParsedCommand } from "@/lib/commandParser";

// Fuzzy search for products by name
async function findProducts(name: string) {
    // First try exact-ish match with ilike
    const { data: exact } = await supabaseAdmin
        .from("productos")
        .select("id, nombre, precio, activo, visible_en_menu, categoria_id, sucursal_id")
        .ilike("nombre", `%${name}%`);

    if (exact && exact.length > 0) return exact;

    // Fallback: try word-by-word matching
    const words = name.split(/\s+/).filter((w) => w.length > 2);
    if (words.length === 0) return [];

    let query = supabaseAdmin
        .from("productos")
        .select("id, nombre, precio, activo, visible_en_menu, categoria_id, sucursal_id");

    // Match all significant words
    for (const word of words) {
        query = query.ilike("nombre", `%${word}%`);
    }

    const { data } = await query;
    return data || [];
}

// Fuzzy search for categories by name
async function findCategories(name: string) {
    const { data: exact } = await supabaseAdmin
        .from("categorias")
        .select("id, nombre, activo, sucursal_id")
        .ilike("nombre", `%${name}%`);

    if (exact && exact.length > 0) return exact;

    const words = name.split(/\s+/).filter((w) => w.length > 2);
    if (words.length === 0) return [];

    let query = supabaseAdmin
        .from("categorias")
        .select("id, nombre, activo, sucursal_id");

    for (const word of words) {
        query = query.ilike("nombre", `%${word}%`);
    }

    const { data } = await query;
    return data || [];
}

// Find products that contain a specific ingredient in their recipes (recetas + fichas técnicas)
async function findProductsByIngredient(ingredientName: string) {
    // 1. Find matching ingredients by name
    const { data: matchingIngredients } = await supabaseAdmin
        .from("ingredientes")
        .select("id, nombre")
        .ilike("nombre", `%${ingredientName}%`);

    if (!matchingIngredients || matchingIngredients.length === 0) return { products: [], ingredientNames: [] };

    const ingredientIds = matchingIngredients.map((i) => i.id);
    const ingredientNames = matchingIngredients.map((i) => i.nombre);
    const productIdSet = new Set<string>();

    // 2. Search in "recetas" table (direct product → ingredient link)
    for (const ingId of ingredientIds) {
        const { data: recetas } = await supabaseAdmin
            .from("recetas")
            .select("producto_id")
            .eq("ingrediente_id", ingId);
        if (recetas) {
            for (const r of recetas) {
                if (r.producto_id) productIdSet.add(r.producto_id);
            }
        }
    }

    // 3. Search in "ficha_tecnica_items" → fichas_tecnicas → productos
    //    Level 1: fichas that directly contain the ingredient
    for (const ingId of ingredientIds) {
        const { data: fichaItems } = await supabaseAdmin
            .from("ficha_tecnica_items")
            .select("ficha_tecnica_id")
            .eq("tipo", "ingrediente")
            .eq("ingrediente_id", ingId);
        if (fichaItems) {
            const fichaIds = fichaItems.map((fi) => fi.ficha_tecnica_id);
            if (fichaIds.length > 0) {
                // Find products linked to these fichas
                const { data: prods } = await supabaseAdmin
                    .from("productos")
                    .select("id")
                    .in("ficha_tecnica_id", fichaIds);
                if (prods) prods.forEach((p) => productIdSet.add(p.id));

                // Level 2: fichas that use these fichas as sub-recipes
                const { data: parentFichaItems } = await supabaseAdmin
                    .from("ficha_tecnica_items")
                    .select("ficha_tecnica_id")
                    .eq("tipo", "sub_receta")
                    .in("sub_ficha_id", fichaIds);
                if (parentFichaItems) {
                    const parentFichaIds = parentFichaItems.map((pfi) => pfi.ficha_tecnica_id);
                    if (parentFichaIds.length > 0) {
                        const { data: prods2 } = await supabaseAdmin
                            .from("productos")
                            .select("id")
                            .in("ficha_tecnica_id", parentFichaIds);
                        if (prods2) prods2.forEach((p) => productIdSet.add(p.id));
                    }
                }
            }
        }
    }

    if (productIdSet.size === 0) return { products: [], ingredientNames };

    // 4. Fetch full product data for all matched product IDs
    const { data: products } = await supabaseAdmin
        .from("productos")
        .select("id, nombre, precio, activo, visible_en_menu, categoria_id, sucursal_id")
        .in("id", Array.from(productIdSet));

    return { products: products || [], ingredientNames };
}

// Log a change for rollback
async function logChange(params: {
    sucursalId: string | null;
    comandoOriginal: string;
    comandoInterpretado: string;
    tablaAfectada: string;
    registroId: string;
    registroNombre: string;
    campoModificado: string;
    valorAnterior: string;
    valorNuevo: string;
}) {
    await supabaseAdmin.from("ai_command_log").insert({
        sucursal_id: params.sucursalId,
        comando_original: params.comandoOriginal,
        comando_interpretado: params.comandoInterpretado,
        tabla_afectada: params.tablaAfectada,
        registro_id: params.registroId,
        registro_nombre: params.registroNombre,
        campo_modificado: params.campoModificado,
        valor_anterior: params.valorAnterior,
        valor_nuevo: params.valorNuevo,
        estado: "ejecutado",
    });
}

// Execute a parsed command
async function executeCommand(cmd: ParsedCommand, originalInput: string) {
    const description = describeCommand(cmd);
    const results: Array<{ nombre: string; detalle: string }> = [];

    if (cmd.targetType === "categoria") {
        const categories = await findCategories(cmd.targetName);
        if (categories.length === 0) {
            return {
                success: false,
                message: `No encontré ninguna categoría que coincida con "${cmd.targetName}"`,
                interpreted: description,
            };
        }

        for (const cat of categories) {
            switch (cmd.intent) {
                case "disable_category": {
                    await supabaseAdmin.from("categorias").update({ activo: false }).eq("id", cat.id);
                    await logChange({
                        sucursalId: cat.sucursal_id,
                        comandoOriginal: originalInput,
                        comandoInterpretado: description,
                        tablaAfectada: "categorias",
                        registroId: cat.id,
                        registroNombre: cat.nombre,
                        campoModificado: "activo",
                        valorAnterior: String(cat.activo),
                        valorNuevo: "false",
                    });
                    results.push({ nombre: cat.nombre, detalle: "desactivada" });
                    break;
                }
                case "enable_category": {
                    await supabaseAdmin.from("categorias").update({ activo: true }).eq("id", cat.id);
                    await logChange({
                        sucursalId: cat.sucursal_id,
                        comandoOriginal: originalInput,
                        comandoInterpretado: description,
                        tablaAfectada: "categorias",
                        registroId: cat.id,
                        registroNombre: cat.nombre,
                        campoModificado: "activo",
                        valorAnterior: String(cat.activo),
                        valorNuevo: "true",
                    });
                    results.push({ nombre: cat.nombre, detalle: "activada" });
                    break;
                }
            }
        }

        return {
            success: true,
            message: `✅ ${results.map((r) => `"${r.nombre}" → ${r.detalle}`).join(", ")}`,
            interpreted: description,
            affectedCount: results.length,
        };
    }

    // ── Ingredient-based commands ──
    if (cmd.intent === "disable_by_ingredient" || cmd.intent === "enable_by_ingredient") {
        const ingName = cmd.ingredientName || cmd.targetName;
        if (!ingName) {
            return {
                success: false,
                message: `No se especificó un ingrediente para buscar.`,
                interpreted: description,
            };
        }

        const { products, ingredientNames } = await findProductsByIngredient(ingName);

        if (ingredientNames.length === 0) {
            return {
                success: false,
                message: `No encontré ningún ingrediente que coincida con "${ingName}"`,
                interpreted: description,
            };
        }

        if (products.length === 0) {
            return {
                success: false,
                message: `Encontré el ingrediente "${ingredientNames.join(", ")}" pero ningún producto tiene ese ingrediente en su receta.`,
                interpreted: description,
            };
        }

        const newActivo = cmd.intent === "enable_by_ingredient";
        const accion = newActivo ? "activado" : "desactivado";

        for (const prod of products) {
            await supabaseAdmin.from("productos").update({ activo: newActivo }).eq("id", prod.id);
            await logChange({
                sucursalId: prod.sucursal_id,
                comandoOriginal: originalInput,
                comandoInterpretado: description,
                tablaAfectada: "productos",
                registroId: prod.id,
                registroNombre: prod.nombre,
                campoModificado: "activo",
                valorAnterior: String(prod.activo),
                valorNuevo: String(newActivo),
            });
            results.push({ nombre: prod.nombre, detalle: accion });
        }

        return {
            success: true,
            message: `✅ Ingrediente(s): ${ingredientNames.join(", ")}\n${results.map((r) => `"${r.nombre}" → ${r.detalle}`).join("\n")}`,
            interpreted: description,
            affectedCount: results.length,
        };
    }

    // Product commands
    const products = await findProducts(cmd.targetName);
    if (products.length === 0) {
        return {
            success: false,
            message: `No encontré ningún producto que coincida con "${cmd.targetName}"`,
            interpreted: description,
        };
    }

    for (const prod of products) {
        switch (cmd.intent) {
            case "disable_product": {
                await supabaseAdmin.from("productos").update({ activo: false }).eq("id", prod.id);
                await logChange({
                    sucursalId: prod.sucursal_id,
                    comandoOriginal: originalInput,
                    comandoInterpretado: description,
                    tablaAfectada: "productos",
                    registroId: prod.id,
                    registroNombre: prod.nombre,
                    campoModificado: "activo",
                    valorAnterior: String(prod.activo),
                    valorNuevo: "false",
                });
                results.push({ nombre: prod.nombre, detalle: "desactivado" });
                break;
            }
            case "enable_product": {
                await supabaseAdmin.from("productos").update({ activo: true }).eq("id", prod.id);
                await logChange({
                    sucursalId: prod.sucursal_id,
                    comandoOriginal: originalInput,
                    comandoInterpretado: description,
                    tablaAfectada: "productos",
                    registroId: prod.id,
                    registroNombre: prod.nombre,
                    campoModificado: "activo",
                    valorAnterior: String(prod.activo),
                    valorNuevo: "true",
                });
                results.push({ nombre: prod.nombre, detalle: "activado" });
                break;
            }
            case "price_increase_percent": {
                const pct = cmd.value || 0;
                const newPrice = Number((prod.precio * (1 + pct / 100)).toFixed(2));
                await supabaseAdmin.from("productos").update({ precio: newPrice }).eq("id", prod.id);
                await logChange({
                    sucursalId: prod.sucursal_id,
                    comandoOriginal: originalInput,
                    comandoInterpretado: description,
                    tablaAfectada: "productos",
                    registroId: prod.id,
                    registroNombre: prod.nombre,
                    campoModificado: "precio",
                    valorAnterior: String(prod.precio),
                    valorNuevo: String(newPrice),
                });
                results.push({ nombre: prod.nombre, detalle: `$${prod.precio} → $${newPrice}` });
                break;
            }
            case "price_decrease_percent": {
                const pct = cmd.value || 0;
                const newPrice = Number((prod.precio * (1 - pct / 100)).toFixed(2));
                await supabaseAdmin.from("productos").update({ precio: newPrice }).eq("id", prod.id);
                await logChange({
                    sucursalId: prod.sucursal_id,
                    comandoOriginal: originalInput,
                    comandoInterpretado: description,
                    tablaAfectada: "productos",
                    registroId: prod.id,
                    registroNombre: prod.nombre,
                    campoModificado: "precio",
                    valorAnterior: String(prod.precio),
                    valorNuevo: String(newPrice),
                });
                results.push({ nombre: prod.nombre, detalle: `$${prod.precio} → $${newPrice}` });
                break;
            }
            case "price_increase_fixed": {
                const amount = cmd.value || 0;
                const newPrice = Number((prod.precio + amount).toFixed(2));
                await supabaseAdmin.from("productos").update({ precio: newPrice }).eq("id", prod.id);
                await logChange({
                    sucursalId: prod.sucursal_id,
                    comandoOriginal: originalInput,
                    comandoInterpretado: description,
                    tablaAfectada: "productos",
                    registroId: prod.id,
                    registroNombre: prod.nombre,
                    campoModificado: "precio",
                    valorAnterior: String(prod.precio),
                    valorNuevo: String(newPrice),
                });
                results.push({ nombre: prod.nombre, detalle: `$${prod.precio} → $${newPrice}` });
                break;
            }
            case "price_decrease_fixed": {
                const amount = cmd.value || 0;
                const newPrice = Number((prod.precio - amount).toFixed(2));
                await supabaseAdmin.from("productos").update({ precio: newPrice }).eq("id", prod.id);
                await logChange({
                    sucursalId: prod.sucursal_id,
                    comandoOriginal: originalInput,
                    comandoInterpretado: description,
                    tablaAfectada: "productos",
                    registroId: prod.id,
                    registroNombre: prod.nombre,
                    campoModificado: "precio",
                    valorAnterior: String(prod.precio),
                    valorNuevo: String(newPrice),
                });
                results.push({ nombre: prod.nombre, detalle: `$${prod.precio} → $${newPrice}` });
                break;
            }
            case "price_set": {
                const newPrice = cmd.value || 0;
                await supabaseAdmin.from("productos").update({ precio: newPrice }).eq("id", prod.id);
                await logChange({
                    sucursalId: prod.sucursal_id,
                    comandoOriginal: originalInput,
                    comandoInterpretado: description,
                    tablaAfectada: "productos",
                    registroId: prod.id,
                    registroNombre: prod.nombre,
                    campoModificado: "precio",
                    valorAnterior: String(prod.precio),
                    valorNuevo: String(newPrice),
                });
                results.push({ nombre: prod.nombre, detalle: `$${prod.precio} → $${newPrice}` });
                break;
            }
            case "rename": {
                const newName = cmd.newName || prod.nombre;
                await supabaseAdmin.from("productos").update({ nombre: newName }).eq("id", prod.id);
                await logChange({
                    sucursalId: prod.sucursal_id,
                    comandoOriginal: originalInput,
                    comandoInterpretado: description,
                    tablaAfectada: "productos",
                    registroId: prod.id,
                    registroNombre: prod.nombre,
                    campoModificado: "nombre",
                    valorAnterior: prod.nombre,
                    valorNuevo: newName,
                });
                results.push({ nombre: prod.nombre, detalle: `→ "${newName}"` });
                break;
            }
            case "hide_menu": {
                await supabaseAdmin.from("productos").update({ visible_en_menu: false }).eq("id", prod.id);
                await logChange({
                    sucursalId: prod.sucursal_id,
                    comandoOriginal: originalInput,
                    comandoInterpretado: description,
                    tablaAfectada: "productos",
                    registroId: prod.id,
                    registroNombre: prod.nombre,
                    campoModificado: "visible_en_menu",
                    valorAnterior: String(prod.visible_en_menu),
                    valorNuevo: "false",
                });
                results.push({ nombre: prod.nombre, detalle: "oculto del menú" });
                break;
            }
            case "show_menu": {
                await supabaseAdmin.from("productos").update({ visible_en_menu: true }).eq("id", prod.id);
                await logChange({
                    sucursalId: prod.sucursal_id,
                    comandoOriginal: originalInput,
                    comandoInterpretado: description,
                    tablaAfectada: "productos",
                    registroId: prod.id,
                    registroNombre: prod.nombre,
                    campoModificado: "visible_en_menu",
                    valorAnterior: String(prod.visible_en_menu),
                    valorNuevo: "true",
                });
                results.push({ nombre: prod.nombre, detalle: "visible en el menú" });
                break;
            }
            case "apply_discount": {
                const pct = cmd.value || 0;
                const newPrice = Number((prod.precio * (1 - pct / 100)).toFixed(2));
                await supabaseAdmin.from("productos").update({ precio: newPrice }).eq("id", prod.id);
                await logChange({
                    sucursalId: prod.sucursal_id,
                    comandoOriginal: originalInput,
                    comandoInterpretado: description,
                    tablaAfectada: "productos",
                    registroId: prod.id,
                    registroNombre: prod.nombre,
                    campoModificado: "precio",
                    valorAnterior: String(prod.precio),
                    valorNuevo: String(newPrice),
                });
                results.push({ nombre: prod.nombre, detalle: `Descuento ${pct}%: $${prod.precio} → $${newPrice}` });
                break;
            }
        }
    }

    return {
        success: true,
        message: `✅ ${results.map((r) => `"${r.nombre}" → ${r.detalle}`).join(", ")}`,
        interpreted: description,
        affectedCount: results.length,
    };
}

// ── POST /api/ai-assistant ──
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { command } = body;

        if (!command || typeof command !== "string") {
            return NextResponse.json(
                { success: false, message: "Falta el comando.", interpreted: "" },
                { status: 400 }
            );
        }

        // 1. Parse the command
        const parseResult = await parseCommand(command);

        if (!parseResult.success || !parseResult.command) {
            return NextResponse.json({
                success: false,
                message: parseResult.error || "No pude entender el comando.",
                interpreted: "",
            });
        }

        // 2. Execute
        const result = await executeCommand(parseResult.command, command);

        return NextResponse.json(result);
    } catch (error) {
        console.error("AI Assistant error:", error);
        return NextResponse.json(
            { success: false, message: "Error interno del servidor.", interpreted: "" },
            { status: 500 }
        );
    }
}

// ── POST /api/ai-assistant?action=undo ──
// Separate endpoint to undo a logged command
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { logId } = body;

        if (!logId) {
            return NextResponse.json({ success: false, message: "Falta logId" }, { status: 400 });
        }

        // Fetch the log entry
        const { data: log, error: logError } = await supabaseAdmin
            .from("ai_command_log")
            .select("*")
            .eq("id", logId)
            .single();

        if (logError || !log) {
            return NextResponse.json({ success: false, message: "No se encontró el registro." }, { status: 404 });
        }

        if (log.estado === "revertido") {
            return NextResponse.json({ success: false, message: "Este cambio ya fue revertido." });
        }

        // Determine the value to restore
        const field = log.campo_modificado;
        let restoreValue: unknown = log.valor_anterior;

        // Convert string back to proper type
        if (restoreValue === "true") restoreValue = true;
        else if (restoreValue === "false") restoreValue = false;
        else if (!isNaN(Number(restoreValue)) && restoreValue !== null && restoreValue !== "") {
            restoreValue = Number(restoreValue);
        }

        // Update the record
        const { error: updateError } = await supabaseAdmin
            .from(log.tabla_afectada)
            .update({ [field]: restoreValue })
            .eq("id", log.registro_id);

        if (updateError) {
            return NextResponse.json({
                success: false,
                message: `Error al revertir: ${updateError.message}`,
            });
        }

        // Mark the log as reverted
        await supabaseAdmin
            .from("ai_command_log")
            .update({ estado: "revertido" })
            .eq("id", logId);

        return NextResponse.json({
            success: true,
            message: `⏪ Revertido: "${log.registro_nombre}" — ${field} restaurado a ${log.valor_anterior}`,
        });
    } catch (error) {
        console.error("Undo error:", error);
        return NextResponse.json(
            { success: false, message: "Error interno del servidor." },
            { status: 500 }
        );
    }
}

// ── GET /api/ai-assistant ── Fetch recent command history
export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from("ai_command_log")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(20);

        if (error) {
            return NextResponse.json({ success: false, message: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error("AI Assistant GET error:", error);
        return NextResponse.json(
            { success: false, message: "Error interno del servidor." },
            { status: 500 }
        );
    }
}
