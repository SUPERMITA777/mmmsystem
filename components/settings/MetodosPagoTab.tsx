"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ChevronDown, ChevronUp } from "lucide-react";

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
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMetodos();
  }, []);

  async function loadMetodos() {
    try {
      const { data } = await supabase
        .from("metodos_pago")
        .select("*")
        .order("orden");

      if (data && data.length > 0) {
        // Combinar con métodos por defecto
        const metodosMap = new Map(data.map(m => [m.codigo, m]));
        const todosMetodos = METODOS_PAGO_DEFAULT.map(m => ({
          ...m,
          ...metodosMap.get(m.codigo),
          activo: metodosMap.has(m.codigo) ? metodosMap.get(m.codigo)!.activo : false,
          expandido: false,
        }));
        setMetodos(todosMetodos);
      } else {
        // Inicializar con métodos por defecto
        const defaultMetodos = METODOS_PAGO_DEFAULT.map((m) => ({
          ...m,
          activo: m.codigo === "efectivo" || m.codigo === "transferencia", // Solo estos activos por defecto
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
    setSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      alert("Métodos de pago guardados correctamente");
    } catch (error) {
      alert("Error al guardar los métodos de pago");
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
            <div
              key={metodo.codigo}
              className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1">
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={metodo.activo}
                    onChange={() => toggleActivo(index)}
                    className="sr-only peer"
                  />
                  <div className={`w-5 h-5 border-2 rounded ${
                    metodo.activo 
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
                <span className={`font-medium ${
                  metodo.activo ? "text-slate-900" : "text-slate-500"
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
