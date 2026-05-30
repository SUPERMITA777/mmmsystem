"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTenant } from "@/context/TenantContext";
import { Loader2, Save, FileText, CheckCircle2, ShieldAlert } from "lucide-react";

export function FiscalTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    habilitado: false,
    razon_social: "",
    cuit: "",
    ingresos_brutos: "",
    inicio_actividades: "",
    punto_venta: "0001",
    condicion_iva: "Responsable Inscripto",
    direccion_comercial: "Buenos Aires, Argentina",
  });

  const { sucursalId } = useTenant();

  useEffect(() => {
    if (sucursalId) loadConfig();
  }, [sucursalId]);

  async function loadConfig() {
    if (!sucursalId) return;
    try {
      const { data } = await supabase
        .from("config_sucursal")
        .select("panel_settings")
        .eq("sucursal_id", sucursalId)
        .maybeSingle();

      if (data?.panel_settings?.fiscal) {
        setConfig({
          habilitado: data.panel_settings.fiscal.habilitado ?? false,
          razon_social: data.panel_settings.fiscal.razon_social ?? "",
          cuit: data.panel_settings.fiscal.cuit ?? "",
          ingresos_brutos: data.panel_settings.fiscal.ingresos_brutos ?? "",
          inicio_actividades: data.panel_settings.fiscal.inicio_actividades ?? "",
          punto_venta: data.panel_settings.fiscal.punto_venta ?? "0001",
          condicion_iva: data.panel_settings.fiscal.condicion_iva ?? "Responsable Inscripto",
          direccion_comercial: data.panel_settings.fiscal.direccion_comercial ?? "Buenos Aires, Argentina",
        });
      }
    } catch (error) {
      console.error("Error cargando configuración fiscal:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!sucursalId) return;
    setSaving(true);
    try {
      const { data: currentCfg } = await supabase
        .from("config_sucursal")
        .select("id, panel_settings")
        .eq("sucursal_id", sucursalId)
        .maybeSingle();

      if (currentCfg) {
        const newSettings = {
          ...(currentCfg.panel_settings || {}),
          fiscal: config,
        };

        const { error } = await supabase
          .from("config_sucursal")
          .update({ panel_settings: newSettings })
          .eq("id", currentCfg.id);

        if (error) throw error;
        alert("Configuración fiscal guardada correctamente.");
      } else {
        // En caso de que no exista el registro, lo creamos
        const { error } = await supabase
          .from("config_sucursal")
          .insert({
            sucursal_id: sucursalId,
            panel_settings: { fiscal: config }
          });
        if (error) throw error;
        alert("Configuración fiscal creada y guardada.");
      }
    } catch (error: any) {
      console.error("Error al guardar configuración fiscal:", error);
      alert("Error al guardar: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Configuración Fiscal (AFIP - Argentina)</h3>
            <p className="text-sm text-gray-500">
              Configurá los datos fiscales de tu comercio para la emisión e impresión de tickets factura y facturas válidas con código QR.
            </p>
          </div>
          <div className="bg-[#7B1FA2]/10 text-[#7B1FA2] p-3 rounded-xl">
            <FileText size={24} />
          </div>
        </div>

        {/* Habilitar / Deshabilitar */}
        <label className="flex items-center justify-between p-4 bg-purple-50/50 border border-purple-100 rounded-xl cursor-pointer hover:bg-purple-50 transition-colors mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.habilitado ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
              {config.habilitado ? <CheckCircle2 size={20} /> : <ShieldAlert size={20} />}
            </div>
            <div>
              <span className="font-semibold text-gray-900">Habilitar Facturación e Impresión Fiscal</span>
              <p className="text-xs text-gray-500">
                Al activar esto, se mostrará un botón de "Imprimir Fiscal" en el panel de pedidos con los datos y el QR de AFIP correspondientes.
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={config.habilitado}
            onChange={(e) => setConfig({ ...config, habilitado: e.target.checked })}
            className="w-5 h-5 text-purple-600 rounded cursor-pointer"
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Razón Social</label>
            <input
              type="text"
              placeholder="Ej: Gastronomía Baires S.R.L."
              value={config.razon_social}
              onChange={(e) => setConfig({ ...config, razon_social: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">CUIT</label>
            <input
              type="text"
              placeholder="Ej: 30-12345678-9"
              value={config.cuit}
              onChange={(e) => setConfig({ ...config, cuit: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Ingresos Brutos (IIBB)</label>
            <input
              type="text"
              placeholder="Ej: 30-12345678-9 o Conv. Multilateral"
              value={config.ingresos_brutos}
              onChange={(e) => setConfig({ ...config, ingresos_brutos: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Inicio de Actividades</label>
            <input
              type="date"
              value={config.inicio_actividades}
              onChange={(e) => setConfig({ ...config, inicio_actividades: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Punto de Venta</label>
            <input
              type="text"
              placeholder="Ej: 00005"
              value={config.punto_venta}
              onChange={(e) => setConfig({ ...config, punto_venta: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Condición de IVA</label>
            <select
              value={config.condicion_iva}
              onChange={(e) => setConfig({ ...config, condicion_iva: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm transition-all"
            >
              <option value="Responsable Inscripto">Responsable Inscripto</option>
              <option value="Monotributista">Responsable Monotributo</option>
              <option value="IVA Exento">IVA Exento</option>
              <option value="No Responsable">No Responsable</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Domicilio Comercial (Buenos Aires)</label>
            <input
              type="text"
              placeholder="Ej: Av. Rivadavia 4500, Flores, CABA"
              value={config.direccion_comercial}
              onChange={(e) => setConfig({ ...config, direccion_comercial: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm transition-all"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-[#7B1FA2] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#6A1B9A] transition-all shadow-lg shadow-purple-200 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={20} />}
          Guardar Configuración Fiscal
        </button>
      </div>
    </div>
  );
}
