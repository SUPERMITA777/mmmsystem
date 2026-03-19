"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTenant } from "@/context/TenantContext";
import {
  QrCode, Plus, Trash2, ToggleLeft, ToggleRight, Save,
  Gift, Percent, Package, Truck, CheckCircle2, XCircle, Clock,
  ChevronDown, ChevronUp, Edit3
} from "lucide-react";

type Premio = {
  id: string;
  nombre: string;
  tipo: "porcentaje" | "fijo" | "envio_gratis" | "producto_gratis";
  valor?: number;
  aplicar_a?: "general" | "categoria" | "producto";
  categoria_id?: string;
  producto_id?: string;
  peso: number; // probabilidad relativa (1-100)
};

type PromoConfig = {
  id?: string;
  activo: boolean;
  premios: Premio[];
  fecha_vencimiento_codigos: string;
};

type CodigoPromo = {
  id: string;
  codigo: string;
  premio: Premio;
  usado: boolean;
  fecha_uso: string | null;
  created_at: string;
  fecha_vencimiento: string | null;
  pedido_id: string | null;
  pedido_canje_id: string | null;
};

const TIPO_LABEL: Record<string, string> = {
  porcentaje: "% Descuento",
  fijo: "$ Descuento fijo",
  envio_gratis: "Envío gratis",
  producto_gratis: "Producto gratis",
};

const TIPO_ICON: Record<string, React.ReactNode> = {
  porcentaje: <Percent size={14} />,
  fijo: <span className="text-xs font-black">$</span>,
  envio_gratis: <Truck size={14} />,
  producto_gratis: <Package size={14} />,
};

function newPremio(): Premio {
  return {
    id: crypto.randomUUID(),
    nombre: "",
    tipo: "porcentaje",
    valor: 10,
    aplicar_a: "general",
    peso: 20,
  };
}

export default function PromoQRPage() {
  const { sucursalId } = useTenant();

  const [config, setConfig] = useState<PromoConfig>({
    activo: false,
    premios: [],
    fecha_vencimiento_codigos: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [codigos, setCodigos] = useState<CodigoPromo[]>([]);
  const [loadingCodigos, setLoadingCodigos] = useState(true);

  // Lookups para producto/categoria
  const [categorias, setCategorias] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);

  const [showCodigos, setShowCodigos] = useState(true);
  const [filterUsado, setFilterUsado] = useState<"all" | "used" | "unused">("all");

  useEffect(() => {
    if (sucursalId) {
      fetchConfig();
      fetchCodigos();
      fetchLookups();
    }
  }, [sucursalId]);

  async function fetchConfig() {
    const { data } = await supabase
      .from("promo_qr_config")
      .select("*")
      .eq("sucursal_id", sucursalId)
      .maybeSingle();

    if (data) {
      setConfig({
        id: data.id,
        activo: data.activo ?? false,
        premios: data.premios ?? [],
        fecha_vencimiento_codigos: data.fecha_vencimiento_codigos ?? "",
      });
    }
  }

  async function fetchCodigos() {
    setLoadingCodigos(true);
    const { data } = await supabase
      .from("promo_qr_codigos")
      .select("*")
      .eq("sucursal_id", sucursalId)
      .order("created_at", { ascending: false });
    setCodigos(data || []);
    setLoadingCodigos(false);
  }

  async function fetchLookups() {
    const [{ data: cats }, { data: prods }] = await Promise.all([
      supabase.from("categorias").select("id, nombre").eq("sucursal_id", sucursalId).eq("activo", true).order("orden"),
      supabase.from("productos").select("id, nombre").eq("activo", true).order("nombre"),
    ]);
    setCategorias(cats || []);
    setProductos(prods || []);
  }

  async function handleSave() {
    if (!sucursalId) return;
    setSaving(true);
    const payload = {
      sucursal_id: sucursalId,
      activo: config.activo,
      premios: config.premios,
      fecha_vencimiento_codigos: config.fecha_vencimiento_codigos || null,
      updated_at: new Date().toISOString(),
    };

    if (config.id) {
      await supabase.from("promo_qr_config").update(payload).eq("id", config.id);
    } else {
      const { data } = await supabase.from("promo_qr_config").insert(payload).select().single();
      if (data) setConfig(prev => ({ ...prev, id: data.id }));
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function updatePremio(idx: number, updates: Partial<Premio>) {
    setConfig(prev => ({
      ...prev,
      premios: prev.premios.map((p, i) => i === idx ? { ...p, ...updates } : p),
    }));
  }

  function removePremio(idx: number) {
    setConfig(prev => ({ ...prev, premios: prev.premios.filter((_, i) => i !== idx) }));
  }

  function addPremio() {
    setConfig(prev => ({ ...prev, premios: [...prev.premios, newPremio()] }));
  }

  const pesoTotal = config.premios.reduce((s, p) => s + (p.peso || 0), 0);

  const filteredCodigos = codigos.filter(c => {
    if (filterUsado === "used") return c.usado;
    if (filterUsado === "unused") return !c.usado;
    return true;
  });

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function isVencido(c: CodigoPromo) {
    if (!c.fecha_vencimiento) return false;
    return new Date(c.fecha_vencimiento) < new Date();
  }

  function getEstado(c: CodigoPromo) {
    if (c.usado) return { label: "Usado", color: "bg-gray-100 text-gray-500", icon: <XCircle size={12} /> };
    if (isVencido(c)) return { label: "Vencido", color: "bg-red-50 text-red-600", icon: <Clock size={12} /> };
    return { label: "Vigente", color: "bg-green-50 text-green-700", icon: <CheckCircle2 size={12} /> };
  }

  return (
    <section className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center shadow">
            <QrCode size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900">Promo QR</h2>
            <p className="text-xs text-gray-500">Los clientes escanean el QR del ticket y ganan un premio aleatorio</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 shadow-sm"
        >
          {saved ? <CheckCircle2 size={15} className="text-green-400" /> : <Save size={15} />}
          {saving ? "Guardando..." : saved ? "¡Guardado!" : "Guardar cambios"}
        </button>
      </div>

      {/* Config card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 shadow-sm space-y-5">

        {/* Toggle activo */}
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="font-bold text-gray-900">Promo activa</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {config.activo
                ? "✅ Los tickets incluirán un código QR con premio"
                : "⛔ La promo está desactivada — no se generarán QR"}
            </p>
          </div>
          <button
            onClick={() => setConfig(prev => ({ ...prev, activo: !prev.activo }))}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-colors ${config.activo ? "bg-green-500 text-white hover:bg-green-400" : "bg-gray-200 text-gray-500 hover:bg-gray-300"}`}
          >
            {config.activo ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
            {config.activo ? "Activa" : "Inactiva"}
          </button>
        </div>

        {/* Fecha vencimiento */}
        <div className="border-t border-gray-100 pt-4">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
            Fecha de vencimiento de los códigos
          </label>
          <input
            type="date"
            value={config.fecha_vencimiento_codigos}
            onChange={e => setConfig(prev => ({ ...prev, fecha_vencimiento_codigos: e.target.value }))}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none focus:border-purple-400 transition-colors"
          />
          <p className="text-[11px] text-gray-400 mt-1">Los códigos generados serán válidos hasta esta fecha</p>
        </div>

        {/* Premios */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                Premios disponibles
              </label>
              {pesoTotal > 0 && (
                <p className="text-[11px] text-gray-400 mt-0.5">Peso total: {pesoTotal} — cada premio se sortea en proporción a su peso</p>
              )}
            </div>
            <button
              onClick={addPremio}
              className="flex items-center gap-1.5 text-xs font-bold text-purple-600 hover:text-purple-700 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-200 transition-colors"
            >
              <Plus size={13} /> Agregar premio
            </button>
          </div>

          {config.premios.length === 0 && (
            <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <Gift size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No hay premios configurados</p>
              <p className="text-xs text-gray-300">Agregá al menos un premio para activar la promo</p>
            </div>
          )}

          <div className="space-y-3">
            {config.premios.map((premio, idx) => (
              <div key={premio.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Nombre */}
                  <fieldset className="border border-gray-300 rounded-lg px-3 py-2 col-span-1 md:col-span-2">
                    <legend className="text-xs text-gray-500 px-1">Nombre del premio</legend>
                    <input
                      type="text"
                      value={premio.nombre}
                      onChange={e => updatePremio(idx, { nombre: e.target.value })}
                      placeholder="Ej: 10% de descuento en toda la carta"
                      className="w-full bg-transparent outline-none text-sm text-gray-900"
                    />
                  </fieldset>
                  {/* Peso */}
                  <fieldset className="border border-purple-200 bg-purple-50/40 rounded-lg px-3 py-2">
                    <legend className="text-xs text-purple-600 px-1">Peso / Probabilidad</legend>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={premio.peso}
                      onChange={e => updatePremio(idx, { peso: parseInt(e.target.value) || 1 })}
                      className="w-full bg-transparent outline-none text-sm text-gray-900 font-bold"
                    />
                  </fieldset>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Tipo */}
                  <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                    <legend className="text-xs text-gray-500 px-1">Tipo</legend>
                    <select
                      value={premio.tipo}
                      onChange={e => updatePremio(idx, { tipo: e.target.value as Premio["tipo"], valor: undefined })}
                      className="w-full bg-transparent outline-none text-sm text-gray-900"
                    >
                      <option value="porcentaje">% Descuento</option>
                      <option value="fijo">$ Descuento fijo</option>
                      <option value="envio_gratis">Envío gratis</option>
                      <option value="producto_gratis">Producto gratis</option>
                    </select>
                  </fieldset>

                  {/* Valor */}
                  {(premio.tipo === "porcentaje" || premio.tipo === "fijo") && (
                    <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                      <legend className="text-xs text-gray-500 px-1">
                        {premio.tipo === "porcentaje" ? "Porcentaje (%)" : "Monto ($)"}
                      </legend>
                      <input
                        type="number"
                        min={1}
                        value={premio.valor ?? ""}
                        onChange={e => updatePremio(idx, { valor: parseFloat(e.target.value) || 0 })}
                        placeholder={premio.tipo === "porcentaje" ? "10" : "500"}
                        className="w-full bg-transparent outline-none text-sm text-gray-900 font-bold"
                      />
                    </fieldset>
                  )}

                  {/* Aplicar a */}
                  {(premio.tipo === "porcentaje" || premio.tipo === "fijo") && (
                    <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                      <legend className="text-xs text-gray-500 px-1">Aplica a</legend>
                      <select
                        value={premio.aplicar_a ?? "general"}
                        onChange={e => updatePremio(idx, { aplicar_a: e.target.value as Premio["aplicar_a"], categoria_id: undefined, producto_id: undefined })}
                        className="w-full bg-transparent outline-none text-sm text-gray-900"
                      >
                        <option value="general">General</option>
                        <option value="categoria">Categoría</option>
                        <option value="producto">Producto</option>
                      </select>
                    </fieldset>
                  )}

                  {/* Categoría */}
                  {premio.aplicar_a === "categoria" && (
                    <fieldset className="border border-blue-200 rounded-lg px-3 py-2">
                      <legend className="text-xs text-blue-500 px-1">Categoría</legend>
                      <select
                        value={premio.categoria_id ?? ""}
                        onChange={e => updatePremio(idx, { categoria_id: e.target.value })}
                        className="w-full bg-transparent outline-none text-sm text-gray-900"
                      >
                        <option value="">Seleccionar...</option>
                        {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    </fieldset>
                  )}

                  {/* Producto */}
                  {(premio.aplicar_a === "producto" || premio.tipo === "producto_gratis") && (
                    <fieldset className="border border-blue-200 rounded-lg px-3 py-2">
                      <legend className="text-xs text-blue-500 px-1">Producto</legend>
                      <select
                        value={premio.producto_id ?? ""}
                        onChange={e => updatePremio(idx, { producto_id: e.target.value })}
                        className="w-full bg-transparent outline-none text-sm text-gray-900"
                      >
                        <option value="">Seleccionar...</option>
                        {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                    </fieldset>
                  )}
                </div>

                {/* Probabilidad visual */}
                {pesoTotal > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all"
                        style={{ width: `${Math.round((premio.peso / pesoTotal) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-purple-600 shrink-0">
                      {Math.round((premio.peso / pesoTotal) * 100)}% prob.
                    </span>
                    <button
                      onClick={() => removePremio(idx)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
                {pesoTotal === 0 && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => removePremio(idx)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Códigos generados */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
        <button
          onClick={() => setShowCodigos(!showCodigos)}
          className="w-full flex items-center justify-between p-5"
        >
          <div>
            <h3 className="font-black text-gray-900 text-left">Códigos generados</h3>
            <p className="text-xs text-gray-500 text-left">{codigos.length} códigos en total</p>
          </div>
          {showCodigos ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </button>

        {showCodigos && (
          <div className="border-t border-gray-100 p-5">
            {/* Filtros */}
            <div className="flex gap-2 mb-4">
              {(["all", "unused", "used"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilterUsado(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filterUsado === f ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  {f === "all" ? "Todos" : f === "used" ? "Usados" : "Vigentes"}
                </button>
              ))}
              <button
                onClick={fetchCodigos}
                className="ml-auto px-3 py-1.5 rounded-lg text-xs font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors"
              >
                Actualizar
              </button>
            </div>

            {loadingCodigos ? (
              <p className="text-center text-gray-400 py-8 text-sm">Cargando...</p>
            ) : filteredCodigos.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <QrCode size={32} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No hay códigos aún</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                      <th className="pb-2 pr-4 font-bold">Código</th>
                      <th className="pb-2 pr-4 font-bold">Premio</th>
                      <th className="pb-2 pr-4 font-bold">Estado</th>
                      <th className="pb-2 pr-4 font-bold">Generado</th>
                      <th className="pb-2 pr-4 font-bold">Vence</th>
                      <th className="pb-2 font-bold">Usado el</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredCodigos.map(c => {
                      const estado = getEstado(c);
                      return (
                        <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-2.5 pr-4">
                            <span className="font-mono font-black text-base text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
                              {c.codigo}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-1.5">
                              <span className="text-gray-400">
                                {TIPO_ICON[c.premio?.tipo] ?? <Gift size={14} />}
                              </span>
                              <span className="font-medium text-gray-800 text-xs">{c.premio?.nombre || "—"}</span>
                            </div>
                            {(c.premio?.tipo === "porcentaje" || c.premio?.tipo === "fijo") && c.premio?.valor && (
                              <span className="text-[10px] text-purple-600 font-bold ml-5">
                                {c.premio.tipo === "porcentaje" ? `${c.premio.valor}%` : `$${c.premio.valor}`}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pr-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${estado.color}`}>
                              {estado.icon} {estado.label}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 text-xs text-gray-500">{formatDate(c.created_at)}</td>
                          <td className="py-2.5 pr-4 text-xs text-gray-500">{c.fecha_vencimiento ? new Date(c.fecha_vencimiento).toLocaleDateString("es-AR") : "Sin vencimiento"}</td>
                          <td className="py-2.5 text-xs text-gray-500">{c.usado ? formatDate(c.fecha_uso) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
