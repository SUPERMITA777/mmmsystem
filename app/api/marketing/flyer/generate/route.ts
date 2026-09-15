import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface ReferenceImage {
    data: string; // base64
    mimeType: string;
    tipo?: string;
    nombre?: string;
}

// Helper para generar imagen con Gemini en la relación de aspecto real
async function generateImageWithGemini(
    apiKey: string,
    promptText: string,
    formato: string = "story_9_16",
    referenceImages: ReferenceImage[] = []
): Promise<{ mimeType: string; data: string }> {
    const modelsToTry = [
        "gemini-2.5-flash-image",
        "gemini-3.1-flash-image",
        "gemini-3-pro-image",
    ];

    // Mapear el formato seleccionado al enum de aspectRatio que acepta la API de Gemini
    let geminiAspectRatio = "9:16";
    if (formato === "post_1_1") {
        geminiAspectRatio = "1:1";
    } else if (formato === "post_4_5") {
        geminiAspectRatio = "4:5";
    }

    // Construir partes del contenido multimodal (imágenes de referencia + prompt textual)
    const parts: any[] = [];
    if (referenceImages && referenceImages.length > 0) {
        for (const ref of referenceImages) {
            if (ref.data) {
                const cleanData = ref.data.includes("base64,")
                    ? ref.data.split("base64,")[1]
                    : ref.data;
                parts.push({
                    inlineData: {
                        mimeType: ref.mimeType || "image/png",
                        data: cleanData,
                    },
                });
            }
        }
    }
    parts.push({ text: promptText });

    let lastError: any = null;

    // Intento 1: Con aspectRatio nativo en generationConfig
    for (const model of modelsToTry) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        {
                            parts,
                        },
                    ],
                    generationConfig: {
                        responseModalities: ["IMAGE"],
                        imageConfig: {
                            aspectRatio: geminiAspectRatio,
                        },
                    },
                }),
            });

            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                console.warn(`Model ${model} with aspectRatio ${geminiAspectRatio} failed:`, errJson);
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
            console.warn(`Error trying ${model} with aspectRatio:`, err.message);
            lastError = err;
        }
    }

    // Intento 2 (Fallback): Sin generationConfig por si acaso
    for (const model of modelsToTry) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }],
                }),
            });
            if (res.ok) {
                const json = await res.json();
                const part = json.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
                if (part?.inlineData?.data) {
                    return {
                        mimeType: part.inlineData.mimeType || "image/png",
                        data: part.inlineData.data,
                    };
                }
            }
        } catch (_) {}
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
        brandConfig?: any;
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
${params.brandConfig?.slogan ? `- Eslogan de la marca: "${params.brandConfig.slogan}"` : ""}
${params.brandConfig?.tono_comunicacion ? `- Tono de comunicación: ${params.brandConfig.tono_comunicacion}` : ""}
${params.brandConfig?.instrucciones_permanentes ? `- Instrucciones creativas permanentes de la marca: ${params.brandConfig.instrucciones_permanentes}` : ""}

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
            imagenes_referencia = [],
            correccion,
            imagen_origen_url,
            flyer_origen_id,
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

        // Load brand config for auto-injection
        let brandConfig: any = null;
        try {
            const { data } = await supabaseAdmin
                .from('marketing_brand_config')
                .select('*')
                .eq('sucursal_id', sucursal_id)
                .single();
            brandConfig = data;
        } catch (e) { /* no brand config, that's fine */ }

        // Merge brand permanent logos into reference images
        const allReferenceImages = [...imagenes_referencia];
        if (brandConfig?.logos && Array.isArray(brandConfig.logos)) {
            for (const logo of brandConfig.logos) {
                if (logo.url) {
                    try {
                        const logoRes = await fetch(logo.url);
                        const logoBuffer = await logoRes.arrayBuffer();
                        const logoBase64 = Buffer.from(logoBuffer).toString('base64');
                        allReferenceImages.push({
                            data: logoBase64,
                            mimeType: 'image/png',
                            tipo: 'Logo de la Marca',
                            nombre: logo.nombre || 'Logo',
                        });
                    } catch (e) {
                        console.warn('Error loading brand logo:', logo.url, e);
                    }
                }
            }
        }

        if (correccion && imagen_origen_url) {
            const alreadyHasOriginal = allReferenceImages.some(
                (ref) => ref.tipo === "Flyer Original" || ref.tipo === "Imagen Original a Corregir"
            );
            if (!alreadyHasOriginal) {
                try {
                    const imgRes = await fetch(imagen_origen_url);
                    const imgBuffer = await imgRes.arrayBuffer();
                    const imgBase64 = Buffer.from(imgBuffer).toString('base64');
                    // Prepend original image
                    allReferenceImages.unshift({
                        data: imgBase64,
                        mimeType: 'image/png',
                        tipo: 'Imagen Original a Corregir',
                        nombre: 'Original',
                    });
                } catch (e) {
                    console.warn('Error loading original image for correction:', imagen_origen_url, e);
                }
            }
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

        const brandInstructions = brandConfig ? `
BRAND IDENTITY & PERMANENT GUIDELINES:
${brandConfig.slogan ? `- Brand slogan: "${brandConfig.slogan}"` : ''}
${brandConfig.tono_comunicacion ? `- Communication tone: ${brandConfig.tono_comunicacion}` : ''}
${brandConfig.colores_marca?.primario ? `- Primary brand color: ${brandConfig.colores_marca.primario}` : ''}
${brandConfig.colores_marca?.secundario ? `- Secondary brand color: ${brandConfig.colores_marca.secundario}` : ''}
${brandConfig.colores_marca?.acento ? `- Accent color: ${brandConfig.colores_marca.acento}` : ''}
${brandConfig.instrucciones_permanentes ? `- Permanent creative instructions: ${brandConfig.instrucciones_permanentes}` : ''}
${brandConfig.logos?.length > 0 ? `- The brand has ${brandConfig.logos.length} permanent logo(s) attached as reference images. Always incorporate them prominently.` : ''}
` : '';

        // 3. Elaborar prompt gastronómico completo
        const refImagesText = allReferenceImages.length > 0
            ? `\nIMPORTANT BRANDING & REFERENCE INSTRUCTIONS:
The user has attached ${allReferenceImages.length} reference image(s) (including the restaurant official logo, brand mark, or dish presentation).
Naturally and prominently incorporate the provided logo/branding element into the promotional flyer composition (e.g. at the top header or prominent corner), preserving its shape, typography, and recognizable brand identity.`
            : "";

        let imagePrompt = "";
        
        if (correccion) {
            imagePrompt = `You are given an existing promotional food flyer image. The user wants to make corrections/modifications to it.

Original flyer details:
- Product: ${producto_nombre}
- Style: ${chosenStyleDesc}
- Format: ${framingDesc}

CORRECTION INSTRUCTIONS FROM THE USER:
${correccion}

Generate a NEW version of this flyer incorporating all the requested corrections while maintaining the overall design style, composition, and format. Keep everything that wasn't mentioned in the corrections the same.
${brandInstructions}`;
        } else {
            imagePrompt = `A professional commercial food advertising flyer poster for a restaurant.
${categoria_nombre ? `Category / Culinary type: ${categoria_nombre}.` : ""}
Featured food / Promotional offer: ${producto_nombre}.
${ingredientes ? `Key ingredients and visible elements: ${ingredientes}.` : ""}
${titulo_promo ? `Theme/Banner style: "${titulo_promo}".` : ""}
Visual style: ${chosenStyleDesc}.
Framing & Composition: ${framingDesc}.
${prompt_usuario ? `Additional creative details: ${prompt_usuario}.` : ""}
${refImagesText}
${brandInstructions}
Key attributes: Mouth-watering appetizing look, photorealistic gourmet food presentation, vibrant colors, premium commercial food photography, award-winning culinary styling, no distorted elements, studio quality.`;
        }

        console.log("Generando imagen con prompt:", imagePrompt, "Imágenes de referencia:", allReferenceImages.length);

        // 4. Generar la imagen y el copy en paralelo
        const [imageResult, socialCopy] = await Promise.all([
            generateImageWithGemini(geminiKey, imagePrompt, formato, allReferenceImages),
            generateCopy(geminiKey, {
                producto_nombre,
                categoria_nombre,
                productos_nombres,
                precio,
                ingredientes,
                estilo,
                prompt_usuario,
                llamado_accion,
                brandConfig,
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
                    prompt_correccion: correccion || null,
                    flyer_origen_id: flyer_origen_id || null,
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
