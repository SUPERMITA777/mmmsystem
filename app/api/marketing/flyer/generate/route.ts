import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Helper para generar imagen con Gemini
async function generateImageWithGemini(apiKey: string, promptText: string): Promise<{ mimeType: string; data: string }> {
    const modelsToTry = [
        "gemini-2.5-flash-image",
        "gemini-3.1-flash-image",
        "gemini-3-pro-image",
    ];

    let lastError: any = null;

    for (const model of modelsToTry) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [{ text: promptText }],
                        },
                    ],
                }),
            });

            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                console.warn(`Model ${model} failed with status ${res.status}:`, errJson);
                lastError = errJson;
                continue;
            }

            const json = await res.json();
            const candidate = json.candidates?.[0];
            const part = candidate?.content?.parts?.find((p: any) => p.inlineData);

            if (part?.inlineData?.data) {
                return {
                    mimeType: part.inlineData.mimeType || "image/png",
                    data: part.inlineData.data,
                };
            }
        } catch (err: any) {
            console.warn(`Error trying ${model}:`, err.message);
            lastError = err;
        }
    }

    throw new Error(
        lastError?.error?.message ||
        "No se pudo generar la imagen con el modelo de IA. Verifica tu GEMINI_API_KEY."
    );
}

// Helper para generar el copy de redes sociales con Gemini
async function generateCopy(
    apiKey: string,
    params: {
        producto_nombre: string;
        categoria_nombre?: string;
        productos_nombres?: string[];
        precio?: number;
        ingredientes?: string;
        estilo?: string;
        prompt_usuario?: string;
        llamado_accion?: string;
    }
): Promise<string> {
    const prompt = `Eres un experto copywriter de marketing gastronómico para redes sociales (Instagram y WhatsApp).
Escribe un copy atractivo, vendedor y tentador para promocionar el siguiente producto o combo en redes sociales:
${params.categoria_nombre ? `- Categoría: ${params.categoria_nombre}` : ""}
- Plato(s) / Promoción: ${params.producto_nombre}
${params.productos_nombres && params.productos_nombres.length > 1 ? `- Productos incluidos en la promo: ${params.productos_nombres.join(", ")}` : ""}
${params.precio ? `- Precio promocional: $${params.precio}` : ""}
${params.ingredientes ? `- Ingredientes / Sabores: ${params.ingredientes}` : ""}
${params.estilo ? `- Estilo de la marca: ${params.estilo}` : ""}
${params.llamado_accion ? `- Llamado a la acción: ${params.llamado_accion}` : "- Llamado a la acción: Pedí ahora por WhatsApp o tienda online"}
${params.prompt_usuario ? `- Instrucciones adicionales del dueño: ${params.prompt_usuario}` : ""}

REGLAS DEL TEXTO:
1. Incluye un título con gancho impactante y emojis atractivos.
2. Descripción corta que despierte el apetito (resaltando ingredientes clave y textura).
3. Si es un combo o incluye varios productos, destaca la combinación ideal de sabores.
4. Precio y oferta clara.
5. Llamado a la acción directo ("Pedí al WhatsApp", "Hacé tu pedido al link").
6. Agrega 5 hashtags relevantes y populares al final.
Responde únicamente con el texto listo para copiar y pegar, sin explicaciones ni saludos.`;

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
            }),
        });

        if (res.ok) {
            const json = await res.json();
            const reply = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (reply) return reply.trim();
        }
    } catch (err) {
        console.warn("Fallo al generar copy con gemini-2.5-flash:", err);
    }

    // Fallback de copy predeterminado si el modelo de texto no responde
    return `🔥 ¡PROMO IMPERDIBLE! 🔥\n\nDisfrutá de nuestro riquísimo ${params.producto_nombre}${params.ingredientes ? ` preparado con ${params.ingredientes}` : ""}.\n${params.precio ? `👉 Precio especial: $${params.precio}\n\n` : "\n"}📲 ¡Hacé tu pedido ahora por WhatsApp y te lo llevamos calentito a tu puerta!\n\n#Delivery #Gastronomia #ComidaRica #FoodLovers #PromoDelDia`;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            sucursal_id,
            producto_id,
            producto_nombre,
            categoria_nombre,
            productos_nombres,
            precio,
            ingredientes,
            prompt_usuario,
            estilo = "gourmet",
            formato = "story_9_16",
            llamado_accion,
            titulo_promo,
        } = body;

        if (!sucursal_id) {
            return NextResponse.json(
                { success: false, message: "sucursal_id es requerido" },
                { status: 400 }
            );
        }

        if (!producto_nombre) {
            return NextResponse.json(
                { success: false, message: "El nombre del producto o promo es requerido" },
                { status: 400 }
            );
        }

        const geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Falta configurar GEMINI_API_KEY en las variables de entorno (.env).",
                },
                { status: 500 }
            );
        }

        // 1. Mapeo de estilos visuales
        const styleDescriptions: Record<string, string> = {
            gourmet:
                "Gourmet fine dining commercial food photography, elegant dark slate background, warm dramatic spotlight, steam gently rising, Michelin star food styling, ultra-detailed textures, 8k advertising poster quality",
            rapido:
                "High-energy commercial fast-food poster, vibrant punchy colors, dynamic composition, floating ingredients, crisp delicious textures, appetizing lighting, bold studio shot",
            rustico:
                "Artisanal rustic culinary style, weathered dark wood table, warm golden hour natural lighting, dusted flour on table, warm brick oven glow in background, authentic cozy homestyle feel",
            minimalista:
                "Modern minimalist gastronomic editorial, soft clean pastel background, elegant gentle shadows, perfectly centered aesthetic composition, contemporary culinary magazine look",
            neon:
                "Cyberpunk nightlife food advertising poster, vibrant magenta and electric blue neon reflections, steaming hot street food, glowing moody reflections, evening party atmosphere",
            fiesta:
                "Celebratory weekend food promo, festive appetizing atmosphere, warm confetti lighting, vibrant appetizing colors, weekend celebration mood",
        };

        const chosenStyleDesc = styleDescriptions[estilo] || styleDescriptions.gourmet;

        // 2. Aspect Ratio framing
        let framingDesc = "vertical 9:16 aspect ratio poster composition, perfectly framed for Instagram Stories and smartphone screens, with clean aesthetic space for food commercial";
        if (formato === "post_1_1") {
            framingDesc = "square 1:1 aspect ratio composition, perfectly framed for Instagram feed post, centered hero shot of the food";
        } else if (formato === "post_4_5") {
            framingDesc = "portrait 4:5 aspect ratio composition, framed for vertical Instagram feed post, delicious commercial food presentation";
        }

        // 3. Elaborar prompt gastronómico completo
        const imagePrompt = `A professional commercial food advertising flyer poster for a restaurant.
${categoria_nombre ? `Category / Culinary type: ${categoria_nombre}.` : ""}
Featured food / Promotional offer: ${producto_nombre}.
${ingredientes ? `Key ingredients and visible elements: ${ingredientes}.` : ""}
${titulo_promo ? `Theme/Banner style: "${titulo_promo}".` : ""}
Visual style: ${chosenStyleDesc}.
Framing & Composition: ${framingDesc}.
${prompt_usuario ? `Additional creative details: ${prompt_usuario}.` : ""}
Key attributes: Mouth-watering appetizing look, photorealistic gourmet food presentation, vibrant colors, premium commercial food photography, award-winning culinary styling, no distorted elements, studio quality.`;

        console.log("Generando imagen con prompt:", imagePrompt);

        // 4. Generar la imagen y el copy en paralelo
        const [imageResult, socialCopy] = await Promise.all([
            generateImageWithGemini(geminiKey, imagePrompt),
            generateCopy(geminiKey, {
                producto_nombre,
                categoria_nombre,
                productos_nombres,
                precio,
                ingredientes,
                estilo,
                prompt_usuario,
                llamado_accion,
            }),
        ]);

        // 5. Convertir imagen base64 a Buffer y subir a Supabase Storage
        const buffer = Buffer.from(imageResult.data, "base64");
        const fileName = `marketing_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.png`;
        const filePath = `flyers/${fileName}`;

        const { error: uploadError } = await supabaseAdmin.storage
            .from("images")
            .upload(filePath, buffer, {
                contentType: imageResult.mimeType || "image/png",
                upsert: true,
            });

        if (uploadError) {
            console.error("Error al subir flyer a Supabase Storage:", uploadError);
            throw new Error(`Error al guardar imagen en Storage: ${uploadError.message}`);
        }

        const {
            data: { publicUrl },
        } = supabaseAdmin.storage.from("images").getPublicUrl(filePath);

        // 6. Guardar en la tabla marketing_flyers
        let savedFlyerId = null;
        try {
            const { data: insertedData, error: dbError } = await supabaseAdmin
                .from("marketing_flyers")
                .insert({
                    sucursal_id,
                    producto_id: producto_id || null,
                    producto_nombre,
                    precio: precio ? Number(precio) : null,
                    ingredientes: ingredientes || null,
                    prompt_usuario: prompt_usuario || null,
                    estilo,
                    formato,
                    imagen_url: publicUrl,
                    copy_social: socialCopy,
                })
                .select()
                .single();

            if (!dbError && insertedData) {
                savedFlyerId = insertedData.id;
            } else if (dbError) {
                console.warn("Aviso al guardar en marketing_flyers:", dbError.message);
            }
        } catch (dbErr) {
            console.warn("Excepción al guardar en tabla marketing_flyers:", dbErr);
        }

        return NextResponse.json({
            success: true,
            flyer: {
                id: savedFlyerId || fileName,
                imagen_url: publicUrl,
                copy_social: socialCopy,
                producto_nombre,
                precio: precio ? Number(precio) : null,
                ingredientes: ingredientes || "",
                estilo,
                formato,
                created_at: new Date().toISOString(),
            },
        });
    } catch (error: any) {
        console.error("Error fatal en /api/marketing/flyer/generate:", error);
        return NextResponse.json(
            {
                success: false,
                message: error.message || "Error al generar flyer promocional con IA",
            },
            { status: 500 }
        );
    }
}
