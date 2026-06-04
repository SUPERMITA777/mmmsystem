"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTenant } from "@/context/TenantContext";

const METODOS_PAGO_DEFAULT = [
  { codigo: "bna_plus", nombre: "BNA+" },
  { codigo: "cuenta_dni", nombre: "Cuenta DNI" },
  { codigo: "dividir_pago", nombre: "Dividir pago" },
  { codigo: "efectivo", nombre: "Efectivo" },
  { codigo: "mercado_pago", nombre: "Mercado Pago" },
  { codigo: "modo", nombre: "MODO" },
  { codigo: "nave", nombre: "Nave" },
  { codigo: "tarjeta_credito", nombre: "Tarjeta de crédito" },
  { codigo: "tarjeta_debito", nombre: "Tarjeta de débito" },
  { codigo: "transferencia", nombre: "Transferencia" },
];

export function MetodosPagoTab() {
  const [metodos, setMetodos] = useState<
    Array<{
      id?: string;
      nombre: string;
      codigo: string;
      activo: boolean;
      expandido?: boolean;
      detalles?: Record<string, any>;
      recargo_porcentaje?: number;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { sucursalId } = useTenant();

  useEffect(() => {
    if (sucursalId) loadMetodos();
  }, [sucursalId]);

  async function loadMetodos() {
    if (!sucursalId) return;
    try {
      const { data } = await supabase
        .from("metodos_pago")
        .select("*")
        .eq("sucursal_id", sucursalId)
        .order("orden");

      if (data && data.length > 0) {
        // Combinar con métodos por defecto
        const metodosMap = new Map(data.map(m => [m.codigo, m]));
        const todosMetodos = METODOS_PAGO_DEFAULT.map(m => ({
          ...m,
          ...metodosMap.get(m.codigo),
          activo: metodosMap.has(m.codigo) ? metodosMap.get(m.codigo)!.activo : false,
          detalles: metodosMap.has(m.codigo) ? metodosMap.get(m.codigo)!.detalles || {} : {},
          recargo_porcentaje: metodosMap.has(m.codigo) ? Number(metodosMap.get(m.codigo)!.recargo_porcentaje || 0) : 0,
          expandido: false,
        }));
        setMetodos(todosMetodos);
      } else {
        // Inicializar con métodos por defecto
        const defaultMetodos = METODOS_PAGO_DEFAULT.map((m) => ({
          ...m,
          activo: m.codigo === "efectivo" || m.codigo === "transferencia", // Solo estos activos por defecto
          detalles: {},
          recargo_porcentaje: 0,
          expandido: false,
        }));
        setMetodos(defaultMetodos);
      }
    } catch (error) {
      console.error("Error cargando métodos de pago:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!sucursalId) return;
    setSaving(true);
    try {
      const dataToSave = metodos.map((m, index) => ({
        sucursal_id: sucursalId,
        nombre: m.nombre,
        codigo: m.codigo,
        activo: m.activo,
        detalles: m.detalles || {},
        recargo_porcentaje: Number(m.recargo_porcentaje || 0),
        orden: index + 1
      }));

      const { error } = await supabase
        .from("metodos_pago")
        .upsert(dataToSave, { onConflict: "sucursal_id,codigo" });

      if (error) throw error;

      alert("Métodos de pago guardados correctamente");
      loadMetodos(); // Recargar para obtener IDs si eran nuevos
    } catch (error: any) {
      console.error("Error al guardar:", error);
      alert(`Error al guardar: ${error.message || "Error desconocido"}`);
    } finally {
      setSaving(false);
    }
  }

  function toggleActivo(index: number) {
    const nuevosMetodos = [...metodos];
    nuevosMetodos[index].activo = !nuevosMetodos[index].activo;
    setMetodos(nuevosMetodos);
  }

  function toggleExpandido(index: number) {
    const nuevosMetodos = [...metodos];
    nuevosMetodos[index].expandido = !nuevosMetodos[index].expandido;
    setMetodos(nuevosMetodos);
  }

  function handleDetalleChange(index: number, key: string, value: any) {
    const nuevosMetodos = [...metodos];
    if (!nuevosMetodos[index].detalles) {
      nuevosMetodos[index].detalles = {};
    }
    nuevosMetodos[index].detalles![key] = value;
    setMetodos(nuevosMetodos);
  }

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Métodos de Pago</h3>
        <p className="text-sm text-slate-600 mb-6">
          Activa o desactiva los métodos de pago disponibles para tus pedidos
        </p>

        <div className="space-y-1">
          {metodos.map((metodo, index) => (
            <div key={metodo.codigo} className="space-y-1">
              <div
                className={`flex items-center justify-between p-3 border border-slate-200 hover:bg-slate-50 transition-colors ${metodo.expandido ? "rounded-t-lg border-b-0 bg-slate-50" : "rounded-lg"}`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={metodo.activo}
                      onChange={() => toggleActivo(index)}
                      className="sr-only peer"
                    />
                    <div className={`w-5 h-5 border-2 rounded ${metodo.activo
                      ? "bg-purple-600 border-purple-600"
                      : "border-slate-300"
                      } flex items-center justify-center`}>
                      {metodo.activo && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </label>
                  <span className={`font-medium ${metodo.activo ? "text-slate-900" : "text-slate-500"
                    }`}>
                    {metodo.nombre}
                  </span>
                </div>
                <button
                  onClick={() => toggleExpandido(index)}
                  className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {metodo.expandido ? (
                    <ChevronUp size={20} />
                  ) : (
                    <ChevronDown size={20} />
                  )}
                </button>
              </div>

              {metodo.expandido && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-b-lg -mt-1 pt-4 shadow-inner space-y-4">
                  {metodo.codigo === "transferencia" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">CBU / CVU</label>
                        <input
                          type="text"
                          value={metodo.detalles?.cbu || ""}
                          onChange={(e) => handleDetalleChange(index, "cbu", e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 outline-none"
                          placeholder="0000000000000000000000"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Alias</label>
                        <input
                          type="text"
                          value={metodo.detalles?.alias || ""}
                          onChange={(e) => handleDetalleChange(index, "alias", e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 outline-none"
                          placeholder="AQUI.MI.ALIAS"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Banco</label>
                        <input
                          type="text"
                          value={metodo.detalles?.banco || ""}
                          onChange={(e) => handleDetalleChange(index, "banco", e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 outline-none"
                          placeholder="Nombre del banco"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Titular</label>
                        <input
                          type="text"
                          value={metodo.detalles?.titular || ""}
                          onChange={(e) => handleDetalleChange(index, "titular", e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 outline-none"
                          placeholder="Nombre del titular de la cuenta"
                        />
                      </div>
                    </div>
                  )}

                  {metodo.codigo === "mercado_pago" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">CVU / Alias</label>
                        <input
                          type="text"
                          value={metodo.detalles?.cvu_alias || ""}
                          onChange={(e) => handleDetalleChange(index, "cvu_alias", e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 outline-none"
                          placeholder="CVU o Alias de Mercado Pago"
                        />
                      </div>
                    </div>
                  )}

                  <div className="border-t border-slate-200 pt-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Instrucciones adicionales para el cliente
                    </label>
                    <textarea
                      value={metodo.detalles?.instrucciones || ""}
                      onChange={(e) => handleDetalleChange(index, "instrucciones", e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 outline-none"
                      placeholder={`Ej: Por favor envía el comprobante al WhatsApp tras seleccionar ${metodo.nombre}.`}
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-200 pt-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Recargo / Incremento (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={metodo.recargo_porcentaje || ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? 0 : parseFloat(e.target.value);
                          const nuevosMetodos = [...metodos];
                          nuevosMetodos[index].recargo_porcentaje = val;
                          setMetodos(nuevosMetodos);
                        }}
                        className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 outline-none"
                        placeholder="0 %"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Se sumará este porcentaje al total del ticket si se selecciona este método de pago.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
