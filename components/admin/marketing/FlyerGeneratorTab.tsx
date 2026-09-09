"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
    Sparkles,
    Search,
    DollarSign,
    Utensils,
    Smartphone,
    Instagram,
    Image as ImageIcon,
    Check,
    Wand2,
    Layers,
    Tag,
    Flame,
    Zap,
    Coffee,
    PartyPopper,
    X,
    Loader2
} from "lucide-react";
import FlyerResultView, { GeneratedFlyer } from "./FlyerResultView";

interface Producto {
    id: string;
    nombre: string;
    precio: number;
    descripcion?: string;
    imagen_url?: string;
    categoria_id?: string;
}

interface FlyerGeneratorTabProps {
    sucursalId: string;
}

const ESTILOS = [
    {
        id: "gourmet",
        name: "Gourmet & Elegante",
        icon: Flame,
        desc: "Fondo oscuro de pizarra, luz cálida de estudio, estilismo de alta cocina.",
        tag: "Recomendado",
    },
    {
        id: "rapido",
        name: "Rápido & Explosivo",
        icon: Zap,
        desc: "Colores vivos, energía dinámica, ingredientes en movimiento y apetitosos.",
        tag: "Fast Food",
    },
    {
        id: "rustico",
        name: "Rústico & Artesanal",
        icon: Coffee,
        desc: "Madera envejecida, horno a leña, harina esparcida, atmósfera acogedora.",
        tag: "Tradicional",
    },
    {
        id: "minimalista",
        name: "Moderno & Minimalista",
        icon: Layers,
        desc: "Fondos limpios pastel, sombras suaves, encuadre editorial y sofisticado.",
        tag: "Estético",
    },
    {
        id: "neon",
        name: "Noche & Neón",
        icon: Sparkles,
        desc: "Reflejos de luces de neón rosa/azul, ambiente nocturno de comida callejera.",
        tag: "Nocturno",
    },
    {
        id: "fiesta",
        name: "Fin de Semana & Promo",
        icon: PartyPopper,
        desc: "Festejo, promociones imperdibles, alegría y comidas para compartir.",
        tag: "Combos",
    },
];

const FORMATOS = [
    {
        id: "story_9_16",
        name: "Historia / Estado (9:16)",
        desc: "Instagram Stories, WhatsApp Estados, TikTok",
        icon: Smartphone,
    },
    {
        id: "post_1_1",
        name: "Post Cuadrado (1:1)",
        desc: "Feed de Instagram, Facebook, Web",
        icon: Instagram,
    },
    {
        id: "post_4_5",
        name: "Post Retrato (4:5)",
        desc: "Feed vertical para smartphones",
        icon: ImageIcon,
    },
];

const SUGERENCIAS_PROMPT = [
    "Queso fundido derritiéndose",
    "Humo suave saliendo del plato",
    "Fondo oscuro y luces cálidas",
    "2x1 viernes por la noche",
    "Papas fritas crocantes y gaseosa fría",
    "Salsa especial chorreando",
    "Masa inflada y dorada al horno",
    "Toque de hierbas frescas y orégano",
];

export default function FlyerGeneratorTab({ sucursalId }: FlyerGeneratorTabProps) {
    const [productos, setProductos] = useState<Producto[]>([]);
    const [loadingProductos, setLoadingProductos] = useState(false);
    const [searchProducto, setSearchProducto] = useState("");
    const [selectedProducto, setSelectedProducto] = useState<Producto | null>(null);

    // Form states
    const [productoNombre, setProductoNombre] = useState("");
    const [precio, setPrecio] = useState<string>("");
    const [ingredientes, setIngredientes] = useState("");
    const [estilo, setEstilo] = useState("gourmet");
    const [formato, setFormato] = useState("story_9_16");
    const [promptUsuario, setPromptUsuario] = useState("");
    const [tituloPromo, setTituloPromo] = useState("¡PROMO ESPECIAL!");
    const [llamadoAccion, setLlamadoAccion] = useState("Pedí ahora por WhatsApp y te lo llevamos a casa");

    // Loading / Result states
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [progressStep, setProgressStep] = useState(0);
    const [generatedFlyer, setGeneratedFlyer] = useState<GeneratedFlyer | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Cargar productos de la sucursal
    useEffect(() => {
        if (sucursalId) {
            loadProductos();
        }
    }, [sucursalId]);

    async function loadProductos() {
        setLoadingProductos(true);
        try {
            const { data, error } = await supabase
                .from("productos")
                .select("id, nombre, precio, descripcion, imagen_url, categoria_id")
                .eq("sucursal_id", sucursalId)
                .eq("activo", true)
                .order("nombre");

            if (!error && data) {
                setProductos(data);
            }
        } catch (err) {
            console.error("Error cargando productos:", err);
        } finally {
            setLoadingProductos(false);
        }
    }

    // Al seleccionar un producto de la carta
    async function handleSelectProduct(prod: Producto) {
        setSelectedProducto(prod);
        setProductoNombre(prod.nombre);
        setPrecio(prod.precio ? prod.precio.toString() : "");
        setSearchProducto("");
        setErrorMsg(null);

        // Extraer ingredientes automáticamente desde el backend
        setLoadingDetails(true);
        try {
            const res = await fetch(`/api/marketing/product-details?producto_id=${prod.id}`);
            const json = await res.json();
            if (json.success) {
                if (json.ingredientesTexto) {
                    setIngredientes(json.ingredientesTexto);
                } else if (prod.descripcion) {
                    setIngredientes(prod.descripcion);
                }
            } else if (prod.descripcion) {
                setIngredientes(prod.descripcion);
            }
        } catch (err) {
            if (prod.descripcion) setIngredientes(prod.descripcion);
        } finally {
            setLoadingDetails(false);
        }
    }

    function handleClearProduct() {
        setSelectedProducto(null);
        setProductoNombre("");
        setPrecio("");
        setIngredientes("");
    }

    function handleAddPromptTag(tag: string) {
        if (!promptUsuario.includes(tag)) {
            setPromptUsuario((prev) => (prev ? `${prev}, ${tag}` : tag));
        }
    }

    // Generar Flyer con IA
    async function handleGenerate() {
        if (!productoNombre.trim()) {
            setErrorMsg("Por favor indica el nombre del producto o la promoción.");
            return;
        }

        setErrorMsg(null);
        setGenerating(true);
        setProgressStep(1);

        // Simulación de pasos de progreso visual
        const stepTimer1 = setTimeout(() => setProgressStep(2), 2500);
        const stepTimer2 = setTimeout(() => setProgressStep(3), 6000);

        try {
            const res = await fetch("/api/marketing/flyer/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sucursal_id: sucursalId,
                    producto_id: selectedProducto?.id || null,
                    producto_nombre: productoNombre,
                    precio: precio ? Number(precio) : null,
                    ingredientes: ingredientes.trim() || undefined,
                    prompt_usuario: promptUsuario.trim() || undefined,
                    estilo,
                    formato,
                    titulo_promo: tituloPromo.trim() || undefined,
                    llamado_accion: llamadoAccion.trim() || undefined,
                }),
            });

            const data = await res.json();

            if (!data.success) {
                throw new Error(data.message || "Error al generar flyer.");
            }

            setGeneratedFlyer(data.flyer);
        } catch (err: any) {
            console.error("Error generando flyer:", err);
            setErrorMsg(err.message || "Ocurrió un error al contactar la IA de generación.");
        } finally {
            clearTimeout(stepTimer1);
            clearTimeout(stepTimer2);
            setGenerating(false);
            setProgressStep(0);
        }
    }

    // Si ya tenemos un flyer recién generado, mostramos la vista de resultado
    if (generatedFlyer) {
        return (
            <FlyerResultView
                flyer={generatedFlyer}
                sucursalId={sucursalId}
                onReset={() => setGeneratedFlyer(null)}
            />
        );
    }

    const filteredProducts = productos.filter((p) =>
        p.nombre.toLowerCase().includes(searchProducto.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Generador Card Principal */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
                {/* Título de sección */}
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 text-[#7B1FA2] flex items-center justify-center shadow-sm">
                            <Wand2 size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 leading-tight">
                                Diseñar Flyer con Inteligencia Artificial
                            </h2>
                            <p className="text-xs text-gray-500">
                                Extraé datos de tu carta, elegí un estilo y generá imágenes gastronómicas en segundos
                            </p>
                        </div>
                    </div>
                </div>

                {/* Error Banner si lo hay */}
                {errorMsg && (
                    <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start justify-between gap-2">
                        <div>
                            <strong className="font-bold">Aviso: </strong>
                            {errorMsg}
                        </div>
                        <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-600">
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* Paso 1: Elegir Producto de la Carta */}
                <div className="space-y-3">
                    <label className="text-sm font-bold text-gray-800 flex items-center gap-2">
                        <Utensils size={16} className="text-[#7B1FA2]" />
                        1. Elegir Producto de la Carta (o escribir uno nuevo)
                    </label>

                    {selectedProducto ? (
                        /* Producto Seleccionado Box */
                        <div className="flex items-center justify-between p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl">
                            <div className="flex items-center gap-3">
                                {selectedProducto.imagen_url ? (
                                    <img
                                        src={selectedProducto.imagen_url}
                                        alt={selectedProducto.nombre}
                                        className="w-12 h-12 rounded-lg object-cover border border-purple-200 shrink-0"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-lg bg-purple-200 text-[#7B1FA2] flex items-center justify-center shrink-0">
                                        <Utensils size={20} />
                                    </div>
                                )}
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-900">{selectedProducto.nombre}</span>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-200 text-[#7B1FA2]">
                                            De la Carta
                                        </span>
                                    </div>
                                    <p className="text-xs text-purple-700 font-semibold mt-0.5">
                                        Precio carta: ${selectedProducto.precio.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleClearProduct}
                                className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-red-600 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200"
                            >
                                Cambiar
                            </button>
                        </div>
                    ) : (
                        /* Selector / Buscador */
                        <div className="relative">
                            <div className="flex items-center gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-100 transition-all">
                                <Search size={18} className="text-gray-400 shrink-0 ml-1" />
                                <input
                                    type="text"
                                    value={searchProducto}
                                    onChange={(e) => setSearchProducto(e.target.value)}
                                    placeholder="Buscar producto de tu carta (ej: Hamburguesa Triple, Pizza Fugazzeta...)"
                                    className="w-full bg-transparent text-sm outline-none text-gray-900 placeholder:text-gray-400"
                                />
                            </div>

                            {searchProducto && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto custom-scrollbar">
                                    {filteredProducts.length > 0 ? (
                                        filteredProducts.map((p) => (
                                            <button
                                                key={p.id}
                                                onClick={() => handleSelectProduct(p)}
                                                className="w-full px-4 py-2.5 text-left text-sm hover:bg-purple-50 flex items-center justify-between border-b border-gray-50 last:border-0 transition-colors"
                                            >
                                                <span className="font-semibold text-gray-900">{p.nombre}</span>
                                                <span className="text-xs font-bold text-[#7B1FA2]">${p.precio}</span>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="p-3 text-center text-xs text-gray-500">
                                            No se encontraron productos con ese nombre. Podés escribirlo manualmente abajo.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Campos de Nombre, Precio e Ingredientes (Auto-rellenados y editables) */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                        <div className="sm:col-span-8 space-y-1">
                            <label className="text-xs font-semibold text-gray-600">Nombre del Producto / Promo</label>
                            <input
                                type="text"
                                value={productoNombre}
                                onChange={(e) => setProductoNombre(e.target.value)}
                                placeholder="Ej: Hamburguesa Doble Cheddar con Bacon"
                                className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                            />
                        </div>
                        <div className="sm:col-span-4 space-y-1">
                            <label className="text-xs font-semibold text-gray-600">Precio de la Oferta ($)</label>
                            <div className="relative">
                                <DollarSign size={16} className="text-gray-400 absolute left-3 top-3" />
                                <input
                                    type="number"
                                    value={precio}
                                    onChange={(e) => setPrecio(e.target.value)}
                                    placeholder="Ej: 8500"
                                    className="w-full pl-8 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                                />
                            </div>
                        </div>

                        {/* Ingredientes / Ficha Técnica */}
                        <div className="sm:col-span-12 space-y-1">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                                    <Tag size={13} className="text-purple-600" />
                                    Ingredientes & Detalles Gastronómicos (extraídos de la carta)
                                </label>
                                {loadingDetails && (
                                    <span className="text-[11px] text-purple-600 flex items-center gap-1">
                                        <Loader2 size={12} className="animate-spin" /> Extrayendo ingredientes...
                                    </span>
                                )}
                            </div>
                            <input
                                type="text"
                                value={ingredientes}
                                onChange={(e) => setIngredientes(e.target.value)}
                                placeholder="Ej: Doble medallón de carne, queso cheddar fundido, panceta crocante, pan de papa brioche"
                                className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                            />
                            <p className="text-[11px] text-gray-400">
                                La IA utilizará estos ingredientes exactos para crear los detalles visuales y el copy tentador.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Paso 2: Formato del Flyer */}
                <div className="space-y-3 pt-2">
                    <label className="text-sm font-bold text-gray-800 flex items-center gap-2">
                        <Smartphone size={16} className="text-[#7B1FA2]" />
                        2. Formato del Flyer
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {FORMATOS.map((f) => {
                            const Icon = f.icon;
                            const active = formato === f.id;
                            return (
                                <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => setFormato(f.id)}
                                    className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${
                                        active
                                            ? "border-[#7B1FA2] bg-purple-50/60 shadow-sm ring-1 ring-purple-500"
                                            : "border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300"
                                    }`}
                                >
                                    <div
                                        className={`p-2 rounded-lg ${
                                            active ? "bg-[#7B1FA2] text-white" : "bg-gray-100 text-gray-500"
                                        }`}
                                    >
                                        <Icon size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-gray-900 leading-snug">{f.name}</p>
                                        <p className="text-[11px] text-gray-500 mt-0.5">{f.desc}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Paso 3: Estilo Visual del Flyer */}
                <div className="space-y-3 pt-2">
                    <label className="text-sm font-bold text-gray-800 flex items-center gap-2">
                        <Sparkles size={16} className="text-[#7B1FA2]" />
                        3. Estilo Visual Gastronómico
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {ESTILOS.map((est) => {
                            const Icon = est.icon;
                            const active = estilo === est.id;
                            return (
                                <button
                                    key={est.id}
                                    type="button"
                                    onClick={() => setEstilo(est.id)}
                                    className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                                        active
                                            ? "border-[#7B1FA2] bg-purple-50/70 shadow-sm ring-1 ring-purple-500"
                                            : "border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300"
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className={`p-1.5 rounded-lg ${
                                                    active ? "bg-[#7B1FA2] text-white" : "bg-gray-100 text-gray-600"
                                                }`}
                                            >
                                                <Icon size={16} />
                                            </div>
                                            <span className="font-bold text-xs text-gray-900">{est.name}</span>
                                        </div>
                                        {est.tag && (
                                            <span
                                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                                    active ? "bg-purple-200 text-purple-800" : "bg-gray-100 text-gray-500"
                                                }`}
                                            >
                                                {est.tag}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-gray-500 leading-snug">{est.desc}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Paso 4: Prompt Personalizado & Detalles Creativos */}
                <div className="space-y-3 pt-2">
                    <label className="text-sm font-bold text-gray-800 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <Wand2 size={16} className="text-[#7B1FA2]" />
                            4. Prompt Creativo Adicional (Opcional)
                        </span>
                        <span className="text-[11px] font-normal text-gray-400">
                            Agregá detalles de ambiente, luces o promociones
                        </span>
                    </label>

                    <textarea
                        rows={2}
                        value={promptUsuario}
                        onChange={(e) => setPromptUsuario(e.target.value)}
                        placeholder="Ej: Iluminación de atardecer, queso derretido goteando, fondo rústico con copas de cerveza, aspecto premium..."
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all resize-none"
                    />

                    {/* Chips de sugerencias rápidas */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-gray-400 mr-1">Sugerencias:</span>
                        {SUGERENCIAS_PROMPT.map((sug) => (
                            <button
                                key={sug}
                                type="button"
                                onClick={() => handleAddPromptTag(sug)}
                                className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-purple-100 hover:text-[#7B1FA2] text-[11px] font-medium text-gray-600 transition-colors"
                            >
                                + {sug}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Botón de Generación Principal */}
                <div className="pt-4 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={generating || !productoNombre.trim()}
                        className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-900 via-[#7B1FA2] to-purple-800 hover:from-purple-800 hover:to-purple-700 text-white font-bold text-base shadow-lg shadow-purple-900/20 flex items-center justify-center gap-3 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {generating ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>
                                    {progressStep === 1 && "Analizando plato e ingredientes..."}
                                    {progressStep === 2 && "Generando póster publicitario con IA..."}
                                    {progressStep === 3 && "Redactando copy para Instagram y WhatsApp..."}
                                    {progressStep === 0 && "Iniciando generación con IA..."}
                                </span>
                            </>
                        ) : (
                            <>
                                <Sparkles size={20} className="text-amber-300" />
                                <span>Generar Flyer con Inteligencia Artificial</span>
                            </>
                        )}
                    </button>
                    <p className="text-xs text-gray-400 text-center mt-2">
                        Impulsado por Google Gemini. La generación tarda aproximadamente entre 5 y 10 segundos.
                    </p>
                </div>
            </div>
        </div>
    );
}
