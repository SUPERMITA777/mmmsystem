"use client";

import { useState, useEffect, useMemo } from "react";
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
    Loader2,
    Plus,
    Filter,
    Percent,
    Upload,
    ImagePlus
} from "lucide-react";
import FlyerResultView, { GeneratedFlyer } from "./FlyerResultView";

export interface ReferenceAsset {
    id: string;
    nombre: string;
    mimeType: string;
    data: string;
    previewUrl: string;
    tipo: "logo" | "producto" | "elemento";
}

interface Categoria {
    id: string;
    nombre: string;
    orden?: number;
    activo: boolean;
}

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
    "Banquete con todos los productos servidos juntos",
    "Toque de hierbas frescas y orégano",
];

export default function FlyerGeneratorTab({ sucursalId }: FlyerGeneratorTabProps) {
    // Data states
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [productos, setProductos] = useState<Producto[]>([]);
    const [loadingData, setLoadingData] = useState(false);

    // Filters and selections
    const [selectedCategoriaId, setSelectedCategoriaId] = useState<string>("all");
    const [searchProducto, setSearchProducto] = useState("");
    const [selectedProductos, setSelectedProductos] = useState<Producto[]>([]);

    // Form fields
    const [productoNombre, setProductoNombre] = useState("");
    const [precio, setPrecio] = useState<string>("");
    const [precioRegularTotal, setPrecioRegularTotal] = useState<number>(0);
    const [ingredientes, setIngredientes] = useState("");
    const [estilo, setEstilo] = useState("gourmet");
    const [formato, setFormato] = useState("story_9_16");
    const [promptUsuario, setPromptUsuario] = useState("");
    const [tituloPromo, setTituloPromo] = useState("¡SUPER PROMO!");
    const [llamadoAccion, setLlamadoAccion] = useState("Pedí ahora por WhatsApp y te lo llevamos a casa");
    const [referenceAssets, setReferenceAssets] = useState<ReferenceAsset[]>([]);
    const [uploadingAsset, setUploadingAsset] = useState(false);

    // Loading & Result states
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [progressStep, setProgressStep] = useState(0);
    const [generatedFlyer, setGeneratedFlyer] = useState<GeneratedFlyer | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Cargar categorías y productos de la sucursal
    useEffect(() => {
        if (sucursalId) {
            loadInitialData();
        }
    }, [sucursalId]);

    async function loadInitialData() {
        setLoadingData(true);
        try {
            // Cargar categorías
            const { data: catsData } = await supabase
                .from("categorias")
                .select("id, nombre, orden, activo")
                .eq("sucursal_id", sucursalId)
                .eq("activo", true)
                .order("orden", { ascending: true });

            if (catsData) setCategorias(catsData);

            // Cargar productos
            const { data: prodsData } = await supabase
                .from("productos")
                .select("id, nombre, precio, descripcion, imagen_url, categoria_id")
                .eq("sucursal_id", sucursalId)
                .eq("activo", true)
                .order("nombre");

            if (prodsData) setProductos(prodsData);
        } catch (err) {
            console.error("Error cargando datos de carta:", err);
        } finally {
            setLoadingData(false);
        }
    }

    // Productos filtrados por categoría y búsqueda
    const productosFiltrados = useMemo(() => {
        return productos.filter((p) => {
            const matchesCat = selectedCategoriaId === "all" || p.categoria_id === selectedCategoriaId;
            const matchesSearch = p.nombre.toLowerCase().includes(searchProducto.toLowerCase());
            return matchesCat && matchesSearch;
        });
    }, [productos, selectedCategoriaId, searchProducto]);

    // Función para recalcular nombre, precios e ingredientes al cambiar los productos seleccionados
    async function updateSelectionDetails(newSelected: Producto[]) {
        setSelectedProductos(newSelected);
        setErrorMsg(null);

        if (newSelected.length === 0) {
            setProductoNombre("");
            setPrecio("");
            setPrecioRegularTotal(0);
            setIngredientes("");
            return;
        }

        // 1. Calcular precio regular total
        const total = newSelected.reduce((sum, p) => sum + (Number(p.precio) || 0), 0);
        setPrecioRegularTotal(total);

        // 2. Establecer nombre sugerido
        const cat = categorias.find((c) => c.id === selectedCategoriaId);
        if (newSelected.length === 1) {
            setProductoNombre(newSelected[0].nombre);
            setPrecio(newSelected[0].precio ? newSelected[0].precio.toString() : "");
        } else {
            const catName = cat ? cat.nombre : "Especial";
            const prodsNames = newSelected.map((p) => p.nombre).join(" + ");
            setProductoNombre(`Promo ${catName}: ${prodsNames}`);
            // Sugerir el total o un descuento aproximado
            setPrecio(total.toString());
        }

        // 3. Extraer ingredientes combinados desde el backend
        setLoadingDetails(true);
        try {
            const idsParam = newSelected.map((p) => p.id).join(",");
            const res = await fetch(`/api/marketing/product-details?producto_ids=${idsParam}`);
            const json = await res.json();

            if (json.success) {
                if (json.ingredientesTexto) {
                    setIngredientes(json.ingredientesTexto);
                } else {
                    const fallbackDesc = newSelected
                        .map((p) => `${p.nombre}: ${p.descripcion || ""}`)
                        .filter((s) => s.trim().length > 0)
                        .join(" | ");
                    setIngredientes(fallbackDesc);
                }
            } else {
                const fallbackDesc = newSelected
                    .map((p) => `${p.nombre}: ${p.descripcion || ""}`)
                    .filter((s) => s.trim().length > 0)
                    .join(" | ");
                setIngredientes(fallbackDesc);
            }
        } catch (err) {
            const fallbackDesc = newSelected
                .map((p) => `${p.nombre}: ${p.descripcion || ""}`)
                .filter((s) => s.trim().length > 0)
                .join(" | ");
            setIngredientes(fallbackDesc);
        } finally {
            setLoadingDetails(false);
        }
    }

    // Alternar selección de un producto individual
    function handleToggleProduct(prod: Producto) {
        const exists = selectedProductos.some((p) => p.id === prod.id);
        const updated = exists
            ? selectedProductos.filter((p) => p.id !== prod.id)
            : [...selectedProductos, prod];

        updateSelectionDetails(updated);
    }

    // Seleccionar todos los productos de la categoría visible actual
    function handleSelectAllVisible() {
        // Unir los visibles con los ya seleccionados sin duplicados
        const ids = new Set(selectedProductos.map((p) => p.id));
        const toAdd = productosFiltrados.filter((p) => !ids.has(p.id));
        updateSelectionDetails([...selectedProductos, ...toAdd]);
    }

    // Deseleccionar todos los productos
    function handleClearAllSelected() {
        updateSelectionDetails([]);
    }

    // Aplicar descuento porcentual rápido al precio total regular
    function handleApplyDiscount(percentage: number) {
        if (!precioRegularTotal) return;
        const discounted = Math.round(precioRegularTotal * (1 - percentage / 100));
        setPrecio(discounted.toString());
    }

    function handleAddPromptTag(tag: string) {
        if (!promptUsuario.includes(tag)) {
            setPromptUsuario((prev) => (prev ? `${prev}, ${tag}` : tag));
        }
    }

    // Procesar y comprimir imágenes de referencia en el cliente
    function processImageFile(file: File, tipo: "logo" | "producto" | "elemento" = "logo"): Promise<ReferenceAsset> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    const maxDim = 800;
                    let { width, height } = img;
                    if (width > maxDim || height > maxDim) {
                        if (width > height) {
                            height = Math.round((height * maxDim) / width);
                            width = maxDim;
                        } else {
                            width = Math.round((width * maxDim) / height);
                            height = maxDim;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                        reject(new Error("No se pudo procesar imagen"));
                        return;
                    }
                    ctx.drawImage(img, 0, 0, width, height);
                    const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
                    const base64Data = canvas.toDataURL(mimeType, 0.85);
                    resolve({
                        id: Math.random().toString(36).substring(2, 9),
                        nombre: file.name,
                        mimeType,
                        data: base64Data,
                        previewUrl: base64Data,
                        tipo,
                    });
                };
                img.onerror = reject;
                img.src = e.target?.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async function handleFilesUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        if (referenceAssets.length + files.length > 3) {
            alert("Podés subir hasta 3 imágenes de referencia (ej: logo, foto de producto o elementos).");
            return;
        }

        setUploadingAsset(true);
        try {
            const newAssets: ReferenceAsset[] = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const defaultTipo = referenceAssets.length === 0 && i === 0 ? "logo" : "elemento";
                const asset = await processImageFile(file, defaultTipo);
                newAssets.push(asset);
            }
            setReferenceAssets((prev) => [...prev, ...newAssets]);
        } catch (err: any) {
            alert("Error al procesar la imagen: " + err.message);
        } finally {
            setUploadingAsset(false);
            e.target.value = "";
        }
    }

    function handleRemoveAsset(id: string) {
        setReferenceAssets((prev) => prev.filter((a) => a.id !== id));
    }

    function handleChangeAssetType(id: string, tipo: "logo" | "producto" | "elemento") {
        setReferenceAssets((prev) =>
            prev.map((a) => (a.id === id ? { ...a, tipo } : a))
        );
    }

    // Enviar solicitud de generación a la IA
    async function handleGenerate() {
        if (!productoNombre.trim()) {
            setErrorMsg("Por favor indica el nombre del producto o de la promoción.");
            return;
        }

        setErrorMsg(null);
        setGenerating(true);
        setProgressStep(1);

        const stepTimer1 = setTimeout(() => setProgressStep(2), 2500);
        const stepTimer2 = setTimeout(() => setProgressStep(3), 6000);

        const cat = categorias.find((c) => c.id === selectedCategoriaId);

        try {
            const res = await fetch("/api/marketing/flyer/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sucursal_id: sucursalId,
                    producto_id: selectedProductos.length === 1 ? selectedProductos[0].id : null,
                    producto_nombre: productoNombre,
                    categoria_nombre: cat ? cat.nombre : undefined,
                    productos_nombres: selectedProductos.map((p) => p.nombre),
                    precio: precio ? Number(precio) : null,
                    ingredientes: ingredientes.trim() || undefined,
                    prompt_usuario: promptUsuario.trim() || undefined,
                    estilo,
                    formato,
                    titulo_promo: tituloPromo.trim() || undefined,
                    llamado_accion: llamadoAccion.trim() || undefined,
                    imagenes_referencia: referenceAssets.map((a) => ({
                        data: a.data,
                        mimeType: a.mimeType,
                        tipo: a.tipo,
                        nombre: a.nombre,
                    })),
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

    // Si hay un flyer recién creado, mostrar la vista del resultado
    if (generatedFlyer) {
        return (
            <FlyerResultView
                flyer={generatedFlyer}
                sucursalId={sucursalId}
                onReset={() => setGeneratedFlyer(null)}
            />
        );
    }

    const currentCatObj = categorias.find((c) => c.id === selectedCategoriaId);

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
                {/* Cabecera */}
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
                                Elegí una categoría, seleccioná los productos de la carta y generá pósters promocionales listos para redes
                            </p>
                        </div>
                    </div>
                </div>

                {/* Banner de error */}
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

                {/* PASO 1: Selección de Categoría y Productos */}
                <div className="space-y-4 bg-gray-50/50 p-4 sm:p-5 rounded-2xl border border-gray-200/80">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-sm font-bold text-gray-800 flex items-center gap-2">
                            <Filter size={16} className="text-[#7B1FA2]" />
                            1. Elegir Categoría y Productos para la Promo
                        </label>
                        {selectedProductos.length > 0 && (
                            <button
                                onClick={handleClearAllSelected}
                                className="text-xs font-semibold text-red-600 hover:underline"
                            >
                                Limpiar selección ({selectedProductos.length})
                            </button>
                        )}
                    </div>

                    {/* Selector de Categorías (Pills con scroll horizontal) */}
                    <div className="space-y-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                            Filtrar por Categoría:
                        </span>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                            <button
                                type="button"
                                onClick={() => setSelectedCategoriaId("all")}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                                    selectedCategoriaId === "all"
                                        ? "bg-[#7B1FA2] text-white shadow-sm"
                                        : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
                                }`}
                            >
                                Todas las Categorías
                                <span
                                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                                        selectedCategoriaId === "all"
                                            ? "bg-white/20 text-white"
                                            : "bg-gray-100 text-gray-600"
                                    }`}
                                >
                                    {productos.length}
                                </span>
                            </button>

                            {categorias.map((cat) => {
                                const count = productos.filter((p) => p.categoria_id === cat.id).length;
                                const isSelected = selectedCategoriaId === cat.id;
                                return (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => setSelectedCategoriaId(cat.id)}
                                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                                            isSelected
                                                ? "bg-[#7B1FA2] text-white shadow-sm"
                                                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
                                        }`}
                                    >
                                        {cat.nombre}
                                        <span
                                            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                                                isSelected
                                                    ? "bg-white/20 text-white"
                                                    : "bg-gray-100 text-gray-600"
                                            }`}
                                        >
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Buscador de productos dentro de la categoría y botón de selección masiva */}
                    <div className="flex flex-col sm:flex-row items-center gap-2.5">
                        <div className="relative flex-1 w-full">
                            <Search size={16} className="text-gray-400 absolute left-3 top-2.5" />
                            <input
                                type="text"
                                value={searchProducto}
                                onChange={(e) => setSearchProducto(e.target.value)}
                                placeholder={
                                    currentCatObj
                                        ? `Buscar en ${currentCatObj.nombre}...`
                                        : "Buscar en todos los productos..."
                                }
                                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                            />
                        </div>

                        {productosFiltrados.length > 0 && (
                            <button
                                type="button"
                                onClick={handleSelectAllVisible}
                                className="w-full sm:w-auto px-3.5 py-2 bg-white hover:bg-purple-50 border border-gray-200 text-[#7B1FA2] hover:border-purple-300 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center justify-center gap-1.5 shadow-sm"
                            >
                                <Plus size={14} />
                                Seleccionar todos los de esta lista ({productosFiltrados.length})
                            </button>
                        )}
                    </div>

                    {/* Lista interactiva de productos para elegir */}
                    <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                            Toca los productos que saldrán en el flyer:
                        </span>

                        {loadingData ? (
                            <div className="p-6 text-center text-xs text-gray-400">
                                <Loader2 size={20} className="animate-spin text-[#7B1FA2] mx-auto mb-1.5" />
                                Cargando carta de productos...
                            </div>
                        ) : productosFiltrados.length === 0 ? (
                            <div className="p-4 bg-white border border-dashed border-gray-300 rounded-xl text-center text-xs text-gray-400">
                                No se encontraron productos en esta selección.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1 custom-scrollbar">
                                {productosFiltrados.map((prod) => {
                                    const isSelected = selectedProductos.some((p) => p.id === prod.id);
                                    return (
                                        <button
                                            key={prod.id}
                                            type="button"
                                            onClick={() => handleToggleProduct(prod)}
                                            className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 group ${
                                                isSelected
                                                    ? "border-purple-500 bg-purple-50/80 shadow-sm ring-1 ring-purple-400"
                                                    : "border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300"
                                            }`}
                                        >
                                            {/* Checkbox visual */}
                                            <div
                                                className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                                    isSelected
                                                        ? "bg-[#7B1FA2] border-[#7B1FA2] text-white"
                                                        : "border-gray-300 bg-white group-hover:border-purple-400"
                                                }`}
                                            >
                                                {isSelected && <Check size={13} strokeWidth={3} />}
                                            </div>

                                            {/* Thumbnail de producto */}
                                            {prod.imagen_url ? (
                                                <img
                                                    src={prod.imagen_url}
                                                    alt={prod.nombre}
                                                    className="w-9 h-9 rounded-lg object-cover shrink-0 border border-gray-200"
                                                />
                                            ) : (
                                                <div className="w-9 h-9 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center shrink-0">
                                                    <Utensils size={15} />
                                                </div>
                                            )}

                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-bold text-gray-900 truncate">{prod.nombre}</p>
                                                <p className="text-[11px] font-semibold text-[#7B1FA2]">${prod.precio.toLocaleString()}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Resumen de Productos Seleccionados (Chips) */}
                    {selectedProductos.length > 0 && (
                        <div className="pt-3 border-t border-purple-100 space-y-2 animate-in fade-in duration-200">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                    <Utensils size={13} className="text-[#7B1FA2]" />
                                    Productos en la Promo ({selectedProductos.length}):
                                </span>
                                {precioRegularTotal > 0 && (
                                    <span className="text-xs text-gray-500 font-semibold">
                                        Precio regular total:{" "}
                                        <strong className="text-gray-800">${precioRegularTotal.toLocaleString()}</strong>
                                    </span>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                                {selectedProductos.map((p) => (
                                    <span
                                        key={p.id}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-100 text-purple-950 text-xs font-semibold border border-purple-200 shadow-2xs"
                                    >
                                        <span>{p.nombre}</span>
                                        <span className="text-[#7B1FA2] font-bold">${p.precio}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleToggleProduct(p)}
                                            className="p-0.5 hover:bg-purple-200 rounded text-purple-600 hover:text-red-600"
                                            title="Quitar de la promo"
                                        >
                                            <X size={12} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* PASO 2: Ajuste de Nombre, Precio Promocional e Ingredientes */}
                <div className="space-y-4">
                    <label className="text-sm font-bold text-gray-800 flex items-center gap-2">
                        <Tag size={16} className="text-[#7B1FA2]" />
                        2. Datos y Oferta de la Promo (Editables)
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                        {/* Nombre de la promo */}
                        <div className="sm:col-span-8 space-y-1">
                            <label className="text-xs font-semibold text-gray-600">
                                Título o Nombre de la Promoción
                            </label>
                            <input
                                type="text"
                                value={productoNombre}
                                onChange={(e) => setProductoNombre(e.target.value)}
                                placeholder="Ej: Combo 2 Pizzas Napolitanas + Bebida"
                                className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                            />
                        </div>

                        {/* Precio Promocional */}
                        <div className="sm:col-span-4 space-y-1">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-gray-600">Precio de la Oferta ($)</label>
                                {precioRegularTotal > 0 && Number(precio) < precioRegularTotal && (
                                    <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
                                        Ahorra ${(precioRegularTotal - Number(precio)).toLocaleString()}
                                    </span>
                                )}
                            </div>
                            <div className="relative">
                                <DollarSign size={16} className="text-gray-400 absolute left-3 top-3" />
                                <input
                                    type="number"
                                    value={precio}
                                    onChange={(e) => setPrecio(e.target.value)}
                                    placeholder="Ej: 19990"
                                    className="w-full pl-8 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                                />
                            </div>

                            {/* Descuentos rápidos si hay precio regular */}
                            {precioRegularTotal > 0 && (
                                <div className="flex items-center gap-1 pt-1">
                                    <span className="text-[10px] text-gray-400 font-semibold flex items-center gap-0.5">
                                        <Percent size={10} /> Descuento:
                                    </span>
                                    {[10, 15, 20, 25].map((pct) => (
                                        <button
                                            key={pct}
                                            type="button"
                                            onClick={() => handleApplyDiscount(pct)}
                                            className="px-1.5 py-0.5 rounded bg-gray-100 hover:bg-purple-100 hover:text-[#7B1FA2] text-[10px] font-bold text-gray-600 transition-colors"
                                        >
                                            -{pct}%
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Ingredientes / Detalles Combinados */}
                        <div className="sm:col-span-12 space-y-1">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                                    <Utensils size={13} className="text-purple-600" />
                                    Ingredientes & Sabores Extraídos de la Carta (Editables)
                                </label>
                                {loadingDetails && (
                                    <span className="text-[11px] text-purple-600 flex items-center gap-1">
                                        <Loader2 size={12} className="animate-spin" /> Extrayendo ingredientes de los productos...
                                    </span>
                                )}
                            </div>
                            <textarea
                                rows={2}
                                value={ingredientes}
                                onChange={(e) => setIngredientes(e.target.value)}
                                placeholder="Ej: Masa artesanal al horno, muzzarella fundida, jamón cocido, hojas de albahaca fresca..."
                                className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 resize-none"
                            />
                            <p className="text-[11px] text-gray-400">
                                La IA usará estos detalles para representar fielmente la comida en el flyer y describirla en el copy.
                            </p>
                        </div>
                    </div>
                </div>

                {/* PASO 3: Formato del Flyer */}
                <div className="space-y-3 pt-2">
                    <label className="text-sm font-bold text-gray-800 flex items-center gap-2">
                        <Smartphone size={16} className="text-[#7B1FA2]" />
                        3. Formato del Flyer
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

                {/* PASO 4: Estilo Visual Gastronómico */}
                <div className="space-y-3 pt-2">
                    <label className="text-sm font-bold text-gray-800 flex items-center gap-2">
                        <Sparkles size={16} className="text-[#7B1FA2]" />
                        4. Estilo Visual Gastronómico
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

                {/* PASO 5: Prompt Personalizado & Detalles Creativos */}
                <div className="space-y-3 pt-2">
                    <label className="text-sm font-bold text-gray-800 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <Wand2 size={16} className="text-[#7B1FA2]" />
                            5. Prompt Creativo Adicional (Opcional)
                        </span>
                        <span className="text-[11px] font-normal text-gray-400">
                            Agregá detalles de ambiente, luces o promociones
                        </span>
                    </label>

                    <textarea
                        rows={2}
                        value={promptUsuario}
                        onChange={(e) => setPromptUsuario(e.target.value)}
                        placeholder="Ej: Iluminación cinematográfica, humo suave saliendo, salsa goteando, banquete apetitoso con todos los productos juntos..."
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

                    {/* Subida de Imágenes de Referencia (Logos, Marcas o Elementos Clave) */}
                    <div className="pt-3 border-t border-gray-100 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                <ImagePlus size={15} className="text-[#7B1FA2]" />
                                Imágenes de Referencia (Logos, Marcas o Elementos Clave)
                            </label>
                            <span className="text-[11px] text-gray-400">
                                {referenceAssets.length}/3 agregadas
                            </span>
                        </div>

                        {/* Botón de Carga */}
                        {referenceAssets.length < 3 && (
                            <label className="flex items-center justify-center gap-2 p-3 bg-purple-50/60 hover:bg-purple-100/60 border border-dashed border-purple-300 rounded-xl cursor-pointer transition-colors group">
                                <Upload size={16} className="text-[#7B1FA2] group-hover:scale-110 transition-transform" />
                                <span className="text-xs font-bold text-[#7B1FA2]">
                                    {uploadingAsset ? "Procesando imagen..." : "Subir Logo o Imagen de Referencia"}
                                </span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    disabled={uploadingAsset}
                                    onChange={handleFilesUpload}
                                    className="hidden"
                                />
                            </label>
                        )}

                        {/* Lista de Imágenes de Referencia cargadas */}
                        {referenceAssets.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                                {referenceAssets.map((asset) => (
                                    <div
                                        key={asset.id}
                                        className="p-2 bg-white rounded-xl border border-gray-200 shadow-2xs flex items-center gap-2.5 relative group"
                                    >
                                        <img
                                            src={asset.previewUrl}
                                            alt={asset.nombre}
                                            className="w-12 h-12 rounded-lg object-contain bg-gray-50 border border-gray-100 p-0.5 shrink-0"
                                        />
                                        <div className="min-w-0 flex-1 space-y-1">
                                            <p className="text-xs font-semibold text-gray-800 truncate" title={asset.nombre}>
                                                {asset.nombre}
                                            </p>
                                            <select
                                                value={asset.tipo}
                                                onChange={(e) =>
                                                    handleChangeAssetType(asset.id, e.target.value as any)
                                                }
                                                className="w-full text-[10px] font-semibold bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 text-gray-700 outline-none"
                                            >
                                                <option value="logo">🏷️ Logo de la Marca</option>
                                                <option value="producto">📸 Foto del Plato</option>
                                                <option value="elemento">⭐ Elemento Clave</option>
                                            </select>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveAsset(asset.id)}
                                            className="p-1 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                                            title="Quitar imagen"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <p className="text-[11px] text-gray-400 leading-snug">
                            La IA analizará esta imagen para incluir tu logo o reproducir los elementos de tu foto en el flyer manteniendo su identidad.
                        </p>
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
                                    {progressStep === 1 && "Analizando productos e ingredientes seleccionados..."}
                                    {progressStep === 2 && "Generando arte publicitario con Google Gemini..."}
                                    {progressStep === 3 && "Redactando copy promocional para Instagram y WhatsApp..."}
                                    {progressStep === 0 && "Iniciando generación con IA..."}
                                </span>
                            </>
                        ) : (
                            <>
                                <Sparkles size={20} className="text-amber-300" />
                                <span>
                                    {selectedProductos.length > 1
                                        ? `Generar Flyer del Combo (${selectedProductos.length} productos) con IA`
                                        : "Generar Flyer con Inteligencia Artificial"}
                                </span>
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
