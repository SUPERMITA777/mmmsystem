"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTenant } from "@/context/TenantContext";
import { Loader2, Save } from "lucide-react";

const MODULOS = [
  { id: "repartidores", label: "Repartidores" },
  { id: "integraciones", label: "Integraciones" },
  { id: "monitor-cocina", label: "Monitor Cocina" },
  { id: "stock", label: "Stock" },
  { id: "reportes", label: "Reportes" },
  { id: "clientes", label: "Clientes" },
  { id: "descuentos", label: "Descuentos" },
  { id: "cajas", label: "Cajas" },
  { id: "permisos", label: "Permisos" },
  { id: "usuarios", label: "Usuarios" },
];

export function PanelTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modulosOcultos, setModulosOcultos] = useState<string[]>([]);
  const { sucursalId } = useTenant();

  useEffect(() => {
    if (sucursalId) loadSettings();
  }, [sucursalId]);

  async function loadSettings() {
    if (!sucursalId) return;
    try {
      const { data, error } = await supabase
        .from("config_sucursal")
        .select("panel_settings")
        .eq("sucursal_id", sucursalId)
        .maybeSingle();

      if (data?.panel_settings?.modulos_ocultos) {
        setModulosOcultos(data.panel_settings.modulos_ocultos);
      }
    } catch (error) {
      console.error("Error cargando configuración del panel:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!sucursalId) return;
    setSaving(true);
    try {
      const { data: current } = await supabase
        .from("config_sucursal")
        .select("panel_settings")
        .eq("sucursal_id", sucursalId)
        .maybeSingle();

      const newSettings = {
        ...(current?.panel_settings || {}),
        modulos_ocultos: modulosOcultos,
      };

      const { error } = await supabase
        .from("config_sucursal")
        .update({ panel_settings: newSettings })
        .eq("sucursal_id", sucursalId);

      if (error) throw error;
      alert("Configuración guardada correctamente");
    } catch (error: any) {
      console.error("Error guardando:", error);
      alert("Error al guardar: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleModulo(id: string) {
    setModulosOcultos((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Gestión de Módulos</h3>
        <p className="text-sm text-gray-500 mb-6">
          Desactiva las secciones que no utilizas para simplificar tu panel de administración.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MODULOS.map((modulo) => (
            <div
              key={modulo.id}
              className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                modulosOcultos.includes(modulo.id)
                  ? "bg-gray-50 border-gray-200"
                  : "bg-white border-purple-100 ring-4 ring-purple-50"
              }`}
              onClick={() => toggleModulo(modulo.id)}
            >
              <div className="flex flex-col">
                <span className="font-semibold text-gray-900">{modulo.label}</span>
                <span className="text-xs text-gray-500">
                  {modulosOcultos.includes(modulo.id) ? "Oculto" : "Visible"}
                </span>
              </div>
              <div
                className={`w-12 h-6 rounded-full relative transition-colors ${
                  modulosOcultos.includes(modulo.id) ? "bg-gray-300" : "bg-purple-600"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                    modulosOcultos.includes(modulo.id) ? "left-1" : "left-7"
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-purple-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save size={20} />
          )}
          Guardar Cambios
        </button>
      </div>
    </div>
  );
}
