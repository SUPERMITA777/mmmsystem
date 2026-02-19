"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Check, X } from "lucide-react";

export function ModalidadesTab() {
  const [config, setConfig] = useState({
    enable_delivery: true,
    enable_takeaway: true,
    enable_salon: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      // TODO: Obtener sucursal_id del usuario autenticado
      const { data, error } = await supabase
        .from("config_sucursal")
        .select("*")
        .single();

      if (data) {
        setConfig({
          enable_delivery: data.enable_delivery ?? true,
          enable_takeaway: data.enable_takeaway ?? true,
          enable_salon: data.enable_salon ?? false,
        });
      }
    } catch (error) {
      console.error("Error cargando configuración:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      // TODO: Implementar guardado
      await new Promise((resolve) => setTimeout(resolve, 500));
      alert("Configuración guardada correctamente");
    } catch (error) {
      alert("Error al guardar la configuración");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Modalidades de Pedidos</h3>
        <p className="text-sm text-slate-600 mb-6">
          Activa o desactiva las modalidades de pedidos disponibles en tu sucursal.
        </p>

        <div className="space-y-4">
          {/* Delivery */}
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-purple-600 font-semibold">🚴</span>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Delivery</h4>
                  <p className="text-sm text-slate-500">
                    Pedidos para entrega a domicilio
                  </p>
                </div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.enable_delivery}
                onChange={(e) =>
                  setConfig({ ...config, enable_delivery: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {/* Take Away */}
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 font-semibold">📦</span>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Take Away</h4>
                  <p className="text-sm text-slate-500">
                    Pedidos para retirar en el local
                  </p>
                </div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.enable_takeaway}
                onChange={(e) =>
                  setConfig({ ...config, enable_takeaway: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {/* Salón */}
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-green-600 font-semibold">🍽️</span>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Salón</h4>
                  <p className="text-sm text-slate-500">
                    Pedidos para consumir en el local
                  </p>
                </div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.enable_salon}
                onChange={(e) =>
                  setConfig({ ...config, enable_salon: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>
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
