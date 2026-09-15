"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ExternalLink, ChefHat, TrendingUp, ChevronDown, Check, Tag, Clock, Calendar, AlertCircle } from "lucide-react";
import ImageCropperModal from "@/components/ui/ImageCropperModal";
import { useTenant } from "@/context/TenantContext";
import { db } from "@/lib/db";
import { isProductPromoActive, DIAS_SEMANA } from "@/lib/promoPriceUtils";

type Categoria = {
  id: string;
  nombre: string;
  activo: boolean;
  orden: number;
};

type Producto = {
  id: string;
  nombre: string;
  nombre_interno?: string;
  descripcion?: string;
  precio: number;
  precio_costo?: number;
  precio_promocional?: number | null;
  promo_activo?: boolean;
  promo_desde?: string | null;
  promo_hasta?: string | null;
  promo_hora_desde?: string | null;
  promo_hora_hasta?: string | null;
  promo_dias?: number[] | null;
  imagen_url?: string;
  categoria_id: string;
  activo: boolean;
  tiempo_coccion?: number;
  visible_en_menu: boolean;
  producto_oculto: boolean;
  producto_sugerido: boolean;
  grupos_adicionales?: string[];
  ficha_tecnica_id?: string | null;
  impresora?: string;
};

type GrupoAdicional = {
  id: string;
  titulo: string;
};

type FichaTecnica = {
  id: string;
  nombre: string;
  costo_total: number;
};

export function ProductoEditor({
  producto,
  categorias,
  onSave,
  onCancel,
  isCreating = false,
  onCreate,
  defaultCategoriaId,
}: {
  producto: Producto | null;
  categorias?: Categoria[];
  onSave: (producto: Producto) => void;
  onCancel: () => void;
  isCreating?: boolean;
  onCreate?: (producto: Omit<Producto, 'id'>) => void;
  defaultCategoriaId?: string;
}) {
  const { sucursalId } = useTenant();
  const emptyProduct: Producto = {
    id: '',
    nombre: '',
    nombre_interno: '',
    descripcion: '',
    precio: 0,
    imagen_url: '',
    categoria_id: defaultCategoriaId || '',
    activo: true,
    visible_en_menu: true,
    producto_oculto: false,
    producto_sugerido: false,
    impresora: 'COCINA1',
    precio_promocional: null,
    promo_activo: false,
    promo_desde: null,
    promo_hasta: null,
    promo_hora_desde: null,
    promo_hora_hasta: null,
    promo_dias: [0, 1, 2, 3, 4, 5, 6],
  };

  const [formData, setFormData] = useState<Producto | null>(isCreating ? emptyProduct : producto);
  const [todosLosGrupos, setTodosLosGrupos] = useState<GrupoAdicional[]>([]);
  const [gruposAsignados, setGruposAsignados] = useState<string[]>([]);
  const [fichasTecnicas, setFichasTecnicas] = useState<FichaTecnica[]>([]);
  const [cropperSrc, setCropperSrc] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const isPromoActiveNow = useMemo(() => {
    if (!formData) return false;
    return isProductPromoActive(formData);
  }, [formData]);

  const descuentoCalculado = useMemo(() => {
    if (!formData || !formData.precio || !formData.precio_promocional) {
      return { monto: 0, porcentaje: 0 };
    }
    const regular = Number(formData.precio);
    const promo = Number(formData.precio_promocional);
    if (promo >= regular || promo <= 0) return { monto: 0, porcentaje: 0 };
    const ahorro = regular - promo;
    return {
      monto: ahorro,
      porcentaje: Math.round((ahorro / regular) * 100),
    };
  }, [formData]);

  const setPromoHoy = () => {
    const today = new Date().toISOString().split('T')[0];
    if (!formData) return;
    setFormData({ ...formData, promo_desde: today, promo_hasta: today });
  };

  const setPromoFinde = () => {
    const now = new Date();
    const day = now.getDay();
    const diffToFri = (5 - day + 7) % 7;
    const friday = new Date(now);
    friday.setDate(now.getDate() + diffToFri);
    const sunday = new Date(friday);
    sunday.setDate(friday.getDate() + 2);
    if (!formData) return;
    setFormData({
      ...formData,
      promo_desde: friday.toISOString().split('T')[0],
      promo_hasta: sunday.toISOString().split('T')[0],
      promo_dias: [5, 6, 0],
    });
  };

  const clearFechas = () => {
    if (!formData) return;
    setFormData({ ...formData, promo_desde: null, promo_hasta: null });
  };

  useEffect(() => {
    if (isCreating) {
      setFormData({ ...emptyProduct, categoria_id: defaultCategoriaId || '' });
      setGruposAsignados([]);
    } else {
      setFormData(producto);
      if (producto) {
        loadGruposYAsignaciones(producto.id);
      }
    }
    
    if (sucursalId) {
      loadFichasTecnicas();
    }
  }, [producto, isCreating, defaultCategoriaId, sucursalId]);

  async function loadFichasTecnicas() {
    if (!sucursalId) return;
    try {
      console.log("[ProductoEditor] Cargando fichas para sucursal:", sucursalId);
      // Intentar primero local (Local-First)
      const local = await db.fichas_tecnicas.where("sucursal_id").equals(sucursalId).toArray();
      if (local && local.length > 0) {
        console.log("[ProductoEditor] Fichas cargadas desde Dexie:", local.length);
        setFichasTecnicas(local as FichaTecnica[]);
        return;
      }

      // Fallback a Supabase si no hay nada local
      console.log("[ProductoEditor] Dexie vacío, consultando Supabase...");
      const { data, error } = await supabase
        .from("fichas_tecnicas")
        .select("id, nombre, costo_total")
        .eq("sucursal_id", sucursalId)
        .order("nombre");
      
      if (error) throw error;
      console.log("[ProductoEditor] Fichas cargadas desde Supabase:", data?.length || 0);
      setFichasTecnicas((data as FichaTecnica[]) || []);
    } catch (err) {
      console.error("[ProductoEditor] Error loading recipes:", err);
    }
  }

  async function loadAllGrupos() {
    if (!sucursalId) return;
    try {
      const local = await db.grupos_adicionales.where("sucursal_id").equals(sucursalId).toArray();
      setTodosLosGrupos(local || []);
    } catch {
      const { data } = await supabase
        .from("grupos_adicionales")
        .select("id, titulo")
        .eq("sucursal_id", sucursalId);
      setTodosLosGrupos(data || []);
    }
  }

  async function loadGruposYAsignaciones(productoId: string) {
    if (!sucursalId) return;
    await loadAllGrupos();
    
    try {
      const { data: asignaciones } = await supabase
        .from("producto_grupos_adicionales")
        .select("grupo_id")
        .eq("producto_id", productoId);
      setGruposAsignados(asignaciones?.map((a: any) => a.grupo_id) || []);
    } catch (err) {
      console.error("Error loading assignments:", err);
    }
  }

  function toggleGrupo(grupoId: string) {
    if (gruposAsignados.includes(grupoId)) {
      setGruposAsignados(gruposAsignados.filter(id => id !== grupoId));
    } else {
      setGruposAsignados([...gruposAsignados, grupoId]);
    }
  }

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isDropdownOpen && !(e.target as Element).closest(".adicionales-dropdown")) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  if (!isCreating && (!producto || !formData)) {
    return (
      <div className="h-full flex items-center justify-center bg-white rounded-r-xl border-y border-r border-gray-200 text-gray-400">
        <p className="text-sm">Selecciona un producto para editarlo</p>
      </div>
    );
  }

  if (!formData) return null;

  function handleChange(field: keyof Producto, value: any) {
    setFormData({ ...formData!, [field]: value });
  }

  return (
    <div className="h-full flex flex-col bg-white rounded-r-xl border-y border-r border-gray-200">
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="px-6 pt-5 pb-2">
          <h3 className="text-base font-semibold text-gray-900">{isCreating ? 'Nuevo producto' : 'Editar producto'}</h3>
        </div>

        <div className="px-6 pb-4 space-y-4">
          {/* Categoría */}
          <fieldset className={`border rounded-lg px-3 pt-0.5 pb-2 transition-colors ${
            (!formData.categoria_id || formData.categoria_id === "sin-categoria") 
              ? "border-orange-500 bg-orange-50" 
              : "border-gray-300 focus-within:border-purple-500"
          }`}>
            <legend className={`text-xs px-1 ${
              (!formData.categoria_id || formData.categoria_id === "sin-categoria") ? "text-orange-600 font-medium" : "text-gray-500"
            }`}>
              {(!formData.categoria_id || formData.categoria_id === "sin-categoria") 
                ? "⚠ Categoría requerida" 
                : "Categoría"}
            </legend>
            <select
              value={formData.categoria_id || ""}
              onChange={(e) => handleChange("categoria_id", e.target.value)}
              className="w-full bg-transparent text-gray-900 text-sm outline-none py-0.5 cursor-pointer"
            >
              <option value="" disabled>Seleccionar categoría...</option>
              {categorias?.map(cat => (
                <option 
                  key={cat.id} 
                  value={cat.id}
                  disabled={cat.id === "sin-categoria"}
                  className={cat.id === "sin-categoria" ? "text-orange-500" : ""}
                >
                  {cat.id === "sin-categoria" ? "⚠ Sin Categoría asignada" : cat.nombre}
                </option>
              ))}
            </select>
          </fieldset>

          {/* Nombre */}
          <fieldset className="border border-gray-300 rounded-lg px-3 pt-0.5 pb-2 focus-within:border-purple-500 transition-colors">
            <legend className="text-xs text-gray-500 px-1">Nombre</legend>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => handleChange("nombre", e.target.value)}
              className="w-full bg-transparent text-gray-900 text-sm outline-none py-0.5"
            />
          </fieldset>

          {/* Nombre interno */}
          <fieldset className="border border-gray-300 rounded-lg px-3 pt-0.5 pb-2 focus-within:border-purple-500 transition-colors">
            <legend className="text-xs text-gray-500 px-1">Nombre interno</legend>
            <input
              type="text"
              value={formData.nombre_interno || ""}
              onChange={(e) => handleChange("nombre_interno", e.target.value)}
              className="w-full bg-transparent text-gray-900 text-sm outline-none py-0.5"
              placeholder="Nombre Interno"
            />
          </fieldset>

          {/* Impresora (Salón/Comandas) */}
          <fieldset className="border border-gray-300 rounded-lg px-3 pt-0.5 pb-2 focus-within:border-purple-500 transition-colors">
            <legend className="text-xs text-gray-500 px-1">Impresora (Comandas)</legend>
            <select
              value={formData.impresora || "COCINA1"}
              onChange={(e) => handleChange("impresora", e.target.value)}
              className="w-full bg-transparent text-gray-900 text-sm outline-none py-0.5 cursor-pointer"
            >
              <option value="COCINA1">COCINA 1</option>
              <option value="COCINA2">COCINA 2</option>
              <option value="ENTRADA">ENTRADA</option>
              <option value="BARRA">BARRA</option>
              <option value="FACTURACION">FACTURACIÓN</option>
            </select>
          </fieldset>

          {/* Descripción */}
          <fieldset className="border border-gray-300 rounded-lg px-3 pt-0.5 pb-2 focus-within:border-purple-500 transition-colors">
            <legend className="text-xs text-gray-500 px-1">Descripción</legend>
            <textarea
              value={formData.descripcion || ""}
              onChange={(e) => handleChange("descripcion", e.target.value)}
              maxLength={255}
              rows={4}
              className="w-full bg-transparent text-gray-900 text-sm outline-none py-0.5 resize-none"
              placeholder="Describe el producto..."
            />
            <p className="text-xs text-gray-400 text-right -mb-0.5">
              {(formData.descripcion?.length || 0)} / 255
            </p>
          </fieldset>

          {/* Precio venta */}
          <fieldset className="border border-gray-300 rounded-lg px-3 pt-0.5 pb-2 focus-within:border-purple-500 transition-colors">
            <legend className="text-xs text-gray-500 px-1">Precio venta</legend>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm">$</span>
              <input
                type="text"
                value={formData.precio != null ? formData.precio.toLocaleString("es-AR") : ""}
                onChange={(e) => handleChange("precio", Number(e.target.value.replace(/\D/g, "")))}
                className="flex-1 bg-transparent text-gray-900 text-sm outline-none py-0.5"
                placeholder="0"
              />
              <button
                type="button"
                className="text-purple-600 hover:text-purple-700 text-xl font-light leading-none transition-colors"
                title="Agregar variante de precio"
              >
                +
              </button>
            </div>
          </fieldset>

          {/* Precio costo */}
          <fieldset className="border border-gray-300 rounded-lg px-3 pt-0.5 pb-2 focus-within:border-purple-500 transition-colors">
            <legend className="text-xs text-gray-500 px-1">Precio costo</legend>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm">$</span>
              <input
                type="text"
                value={formData.precio_costo != null ? formData.precio_costo.toLocaleString("es-AR") : ""}
                onChange={(e) => handleChange("precio_costo", Number(e.target.value.replace(/\D/g, "")))}
                className="flex-1 bg-transparent text-gray-900 text-sm outline-none py-0.5"
                placeholder="0"
              />
            </div>
          </fieldset>

          {/* Precio Promocional Temporal */}
          <div className="border border-amber-200/80 rounded-xl p-3.5 bg-amber-50/40 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Tag size={15} />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-gray-900 flex items-center gap-1.5 leading-none">
                    Precio Promocional Temporal
                    {isPromoActiveNow && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">
                        ACTIVA AHORA
                      </span>
                    )}
                  </h5>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Reemplaza temporalmente el precio dentro del período fijado
                  </p>
                </div>
              </div>

              {/* Switch Activar Promo */}
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={!!formData.promo_activo}
                  onChange={(e) => handleChange("promo_activo", e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {formData.promo_activo && (
              <div className="space-y-3 pt-1 border-t border-amber-200/60 animate-in fade-in duration-200">
                {/* Input de Precio Promocional y Cálculo de Descuento */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
                  <fieldset className="border border-amber-300 rounded-lg px-3 pt-0.5 pb-1.5 bg-white focus-within:border-amber-500 transition-colors shadow-xs">
                    <legend className="text-[10px] font-bold text-amber-800 px-1">
                      Precio Promocional ($)
                    </legend>
                    <div className="flex items-center gap-1.5">
                      <span className="text-amber-700 font-bold text-sm">$</span>
                      <input
                        type="text"
                        value={formData.precio_promocional != null ? formData.precio_promocional.toLocaleString("es-AR") : ""}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          handleChange("precio_promocional", val ? Number(val) : null);
                        }}
                        className="flex-1 bg-transparent text-gray-900 font-black text-sm outline-none py-0.5"
                        placeholder="Ej: 10000"
                      />
                    </div>
                  </fieldset>

                  {/* Ahorro / Descuento Calculado */}
                  <div className="p-2 rounded-lg bg-white border border-amber-200/70 text-xs flex items-center justify-between shadow-xs">
                    <div>
                      <span className="text-gray-400 block text-[10px]">Ahorro cliente:</span>
                      <span className="font-black text-amber-700 text-xs">
                        {descuentoCalculado.monto > 0
                          ? `$ ${new Intl.NumberFormat("es-AR").format(descuentoCalculado.monto)}`
                          : "$ 0"}
                      </span>
                    </div>
                    {descuentoCalculado.porcentaje > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                        -{descuentoCalculado.porcentaje}% OFF
                      </span>
                    )}
                  </div>
                </div>

                {/* Advertencia si promo >= precio normal */}
                {formData.precio_promocional != null && formData.precio_promocional >= formData.precio && (
                  <p className="text-[11px] text-red-600 bg-red-50 p-2 rounded-lg border border-red-200 flex items-center gap-1.5">
                    <AlertCircle size={13} />
                    El precio promocional debe ser menor al precio de venta (${formData.precio}).
                  </p>
                )}

                {/* Rango de Fechas */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-gray-700 flex items-center gap-1 uppercase tracking-wider">
                      <Calendar size={12} className="text-amber-600" />
                      Rango de Fechas (opcional)
                    </label>
                    <div className="flex gap-1.5 text-[10px]">
                      <button
                        type="button"
                        onClick={setPromoHoy}
                        className="text-amber-700 hover:underline font-semibold"
                      >
                        Hoy
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={setPromoFinde}
                        className="text-amber-700 hover:underline font-semibold"
                      >
                        Fin de semana
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={clearFechas}
                        className="text-gray-400 hover:underline"
                      >
                        Sin límite
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[9px] text-gray-500 block mb-0.5">Desde:</span>
                      <input
                        type="date"
                        value={formData.promo_desde || ""}
                        onChange={(e) => handleChange("promo_desde", e.target.value || null)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-800 outline-none focus:border-amber-400 transition-colors"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-500 block mb-0.5">Hasta:</span>
                      <input
                        type="date"
                        value={formData.promo_hasta || ""}
                        onChange={(e) => handleChange("promo_hasta", e.target.value || null)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-800 outline-none focus:border-amber-400 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Rango de Horarios */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-gray-700 flex items-center gap-1 uppercase tracking-wider">
                      <Clock size={12} className="text-amber-600" />
                      Horario de Vigencia (opcional)
                    </label>
                    <div className="flex gap-1.5 text-[10px]">
                      <button
                        type="button"
                        onClick={() => {
                          handleChange("promo_hora_desde", "20:00");
                          handleChange("promo_hora_hasta", "23:59");
                        }}
                        className="text-amber-700 hover:underline font-semibold"
                      >
                        Noche (20 a 00hs)
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => {
                          handleChange("promo_hora_desde", null);
                          handleChange("promo_hora_hasta", null);
                        }}
                        className="text-gray-400 hover:underline"
                      >
                        Todo el día
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[9px] text-gray-500 block mb-0.5">Hora desde:</span>
                      <input
                        type="time"
                        value={formData.promo_hora_desde || ""}
                        onChange={(e) => handleChange("promo_hora_desde", e.target.value || null)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-800 outline-none focus:border-amber-400 transition-colors"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-500 block mb-0.5">Hora hasta:</span>
                      <input
                        type="time"
                        value={formData.promo_hora_hasta || ""}
                        onChange={(e) => handleChange("promo_hora_hasta", e.target.value || null)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-800 outline-none focus:border-amber-400 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Días de la Semana */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">
                      Días aplicables:
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const allDays = [0, 1, 2, 3, 4, 5, 6];
                        const current = formData.promo_dias || [];
                        if (current.length === 7) {
                          handleChange("promo_dias", []);
                        } else {
                          handleChange("promo_dias", allDays);
                        }
                      }}
                      className="text-[10px] text-amber-700 hover:underline font-semibold"
                    >
                      {(formData.promo_dias || []).length === 7 ? "Deseleccionar todos" : "Todos los días"}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {DIAS_SEMANA.map((d) => {
                      const selected = (formData.promo_dias || []).includes(d.dia);
                      return (
                        <button
                          key={d.dia}
                          type="button"
                          onClick={() => {
                            const current = formData.promo_dias || [0, 1, 2, 3, 4, 5, 6];
                            const next = selected
                              ? current.filter((x) => x !== d.dia)
                              : [...current, d.dia];
                            handleChange("promo_dias", next);
                          }}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                            selected
                              ? "bg-amber-500 text-white shadow-xs"
                              : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-100"
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Estado en vivo */}
                <div className="pt-2 border-t border-amber-200/60 flex items-center gap-2 text-xs">
                  <span className="text-[11px] text-gray-500">Estado actual:</span>
                  {isPromoActiveNow ? (
                    <span className="font-bold text-green-700 bg-green-100 border border-green-300 px-2 py-0.5 rounded-full text-[10px] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      Vigente ahora ($ {new Intl.NumberFormat("es-AR").format(formData.precio_promocional || 0)})
                    </span>
                  ) : (
                    <span className="font-semibold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full text-[10px]">
                      ⏳ Programada (Inactiva en este momento)
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Ficha Técnica / Receta */}
          <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/50">
            <div className="flex items-center gap-2 mb-2">
              <ChefHat size={14} className="text-purple-500" />
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Ficha Técnica / Receta</span>
            </div>
            <select
              value={formData.ficha_tecnica_id || ""}
              onChange={e => {
                handleChange("ficha_tecnica_id", e.target.value || null);
              }}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-purple-400 transition-colors"
            >
              <option value="">Sin receta asignada</option>
              {fichasTecnicas.map(f => (
                <option key={f.id} value={f.id}>{f.nombre}</option>
              ))}
            </select>
            {formData.ficha_tecnica_id && (() => {
              const ficha = fichasTecnicas.find(f => f.id === formData.ficha_tecnica_id);
              if (!ficha) return null;
              const costo = ficha.costo_total;
              const precio = formData.precio || 0;
              const utilidad = precio - costo;
              const margen = costo > 0 ? (utilidad / costo) * 100 : 0;
              const margenColor = margen > 100 ? "bg-green-100 text-green-700" : margen > 50 ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-600";
              return (
                <div className="mt-2 flex items-center justify-between bg-white rounded-lg border border-gray-100 px-3 py-2">
                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <span className="text-gray-400 font-medium">Costo receta </span>
                      <span className="font-black text-gray-800">$ {new Intl.NumberFormat("es-AR").format(costo)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 font-medium">Utilidad </span>
                      <span className={`font-black ${utilidad >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {utilidad >= 0 ? "+" : ""}$ {new Intl.NumberFormat("es-AR").format(utilidad)}
                      </span>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black ${margenColor}`}>
                    <TrendingUp size={10} /> {Math.round(margen)}%
                  </span>
                </div>
              );
            })()}
          </div>

          {/* Visibilidad y Stock */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Visibilidad y Estado</h4>
            <div className="space-y-2.5">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.activo}
                  onChange={(e) => handleChange("activo", e.target.checked)}
                  className="w-4 h-4 accent-purple-600 rounded"
                />
                <div className="flex flex-col">
                  <span className="text-sm text-gray-700 font-medium">Producto activo</span>
                  <span className="text-[11px] text-gray-400">Permite vender o pausar el producto completamente</span>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.visible_en_menu}
                  onChange={(e) => handleChange("visible_en_menu", e.target.checked)}
                  className="w-4 h-4 accent-purple-600 rounded"
                />
                <div className="flex flex-col">
                  <span className="text-sm text-gray-700 font-medium">Visible en menú</span>
                  <span className="text-[11px] text-gray-400">El producto aparece en la página de venta pública</span>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.producto_oculto}
                  onChange={(e) => handleChange("producto_oculto", e.target.checked)}
                  className="w-4 h-4 accent-purple-600 rounded"
                />
                <div className="flex flex-col">
                  <span className="text-sm text-gray-700 font-medium">Producto oculto</span>
                  <span className="text-[11px] text-gray-400">Ocultar completamente (incluso del panel admin si se filtra)</span>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.producto_sugerido}
                  onChange={(e) => handleChange("producto_sugerido", e.target.checked)}
                  className="w-4 h-4 accent-purple-600 rounded"
                />
                <span className="text-sm text-gray-700 font-medium">Producto sugerido</span>
              </label>
            </div>

            {/* Stock simple */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Control de Stock</h4>
              <fieldset className="border border-gray-300 rounded-lg px-3 pt-0.5 pb-2">
                <legend className="text-xs text-gray-500 px-1">Stock disponible</legend>
                <input
                  type="number"
                  className="w-full bg-transparent text-gray-900 text-sm outline-none py-0.5"
                  placeholder="Dejar vacío para no limitar"
                />
              </fieldset>
              <p className="text-[11px] text-gray-400 mt-1">Si está vacío, el stock es ilimitado.</p>
            </div>
          </div>

          {/* Adicionales */}
          <div className="border-t border-gray-100 pt-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-4">Adicionales / Modificadores</h4>
            {todosLosGrupos.length === 0 ? (
              <p className="text-xs text-gray-400">No hay grupos de adicionales creados.</p>
            ) : (
              <div className="relative adicionales-dropdown">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 bg-white border rounded-xl text-sm transition-all shadow-sm hover:border-purple-300 ${isDropdownOpen ? 'border-purple-500 ring-2 ring-purple-100' : 'border-gray-200'}`}
                >
                  <span className={gruposAsignados.length > 0 ? "text-gray-900 font-medium" : "text-gray-400"}>
                    {gruposAsignados.length === 0 
                      ? "Seleccionar adicionales..." 
                      : `${gruposAsignados.length} ${gruposAsignados.length === 1 ? 'grupo asignado' : 'grupos asignados'}`}
                  </span>
                  <ChevronDown size={18} className={`text-gray-400 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180 text-purple-500' : ''}`} />
                </button>

                {isDropdownOpen && (
                  <div className="absolute z-50 mt-2 w-full bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="max-h-60 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                      {todosLosGrupos.map(g => {
                        const isSelected = gruposAsignados.includes(g.id);
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => toggleGrupo(g.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                              isSelected 
                                ? 'bg-purple-50 text-purple-700' 
                                : 'hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                              isSelected 
                                ? 'bg-purple-600 border-purple-600' 
                                : 'bg-white border-gray-300'
                            }`}>
                              {isSelected && <Check size={14} className="text-white" />}
                            </div>
                            <span className={`text-sm font-medium ${isSelected ? 'text-purple-900' : 'text-gray-700'}`}>
                              {g.titulo}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Imagen de producto - Movido al final */}
          <div className="border-t border-gray-100 pt-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-4">Imagen del producto</h4>
            <div className="space-y-4">
              {formData.imagen_url ? (
                <div className="relative group">
                  <img
                    src={formData.imagen_url}
                    alt={formData.nombre}
                    className="w-full h-48 object-cover rounded-xl border border-gray-200 bg-gray-50"
                  />
                  <div className="mt-3 flex items-center gap-4 text-xs">
                    <button
                      type="button"
                      onClick={() => document.getElementById('product-image-upload')?.click()}
                      className="text-purple-600 font-medium hover:text-purple-700 transition-colors"
                    >
                      Cambiar imagen
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={() => handleChange("imagen_url", "")}
                      className="text-red-500 font-medium hover:text-red-600 transition-colors"
                    >
                      Eliminar imagen
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => document.getElementById('product-image-upload')?.click()}
                  className="w-full h-32 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-purple-300 hover:bg-purple-50 transition-all text-gray-500 group"
                >
                  <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-white transition-colors">
                    <ExternalLink size={20} className="text-gray-400 group-hover:text-purple-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700">Subir imagen</p>
                    <p className="text-[11px] text-gray-400">PNG, JPG hasta 10MB</p>
                  </div>
                </button>
              )}

              <input
                id="product-image-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setCropperSrc(reader.result as string);
                  reader.readAsDataURL(file);
                  e.target.value = '';
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sticky action buttons */}
      <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-white rounded-br-xl">
        <button
          onClick={onCancel}
          className="text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors"
        >
          Cancelar
        </button>
        <div className="flex gap-3">
          {!isCreating && (
            <button className="flex items-center gap-2 px-4 py-2 text-purple-600 border border-purple-500 rounded-lg hover:bg-purple-50 transition-colors text-sm font-medium">
              <ExternalLink size={14} />
              Ver producto
            </button>
          )}
          <button
            onClick={() => {
              if (isCreating && onCreate) {
                const { id, ...newProduct } = formData;
                onCreate({ ...newProduct, grupos_adicionales: gruposAsignados });
              } else {
                onSave({ ...formData, grupos_adicionales: gruposAsignados });
              }
            }}
            className="px-5 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
          >
            {isCreating ? 'Guardar' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Image Cropper */}
      <ImageCropperModal
        isOpen={!!cropperSrc}
        imageSrc={cropperSrc || ''}
        aspectRatio={1}
        maxDimension={800}
        onCropComplete={async (croppedBlob) => {
          try {
            const fileName = `${Math.random().toString(36).substring(2)}.jpg`;
            const filePath = `products/${fileName}`;

            const { error: uploadError } = await supabase.storage
              .from('images')
              .upload(filePath, croppedBlob, { contentType: 'image/jpeg' });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
              .from('images')
              .getPublicUrl(filePath);

            handleChange('imagen_url', publicUrl);
            setCropperSrc(null);
          } catch (error: any) {
            alert('Error subiendo la imagen: ' + error.message);
          }
        }}
        onClose={() => setCropperSrc(null)}
        title="Recortar imagen del producto"
      />
    </div>
  );
}
