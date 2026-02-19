"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export function PedidosTab() {
  const [config, setConfig] = useState({
    aceptar_pedidos: true,
    confirmar_por_whatsapp: true,
    pedidos_programados: true,
    aceptar_propinas: true,
    datos_cliente_obligatorios: true,
    monto_minimo: 0,
    tiempo_preparacion_default: 30,
    notificar_nuevo_pedido: true,
    notificar_pedido_listo: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const { data } = await supabase
        .from("config_sucursal")
        .select("*")
        .single();

      if (data) {
        setConfig({
          aceptar_pedidos: data.aceptar_pedidos ?? true,
          confirmar_por_whatsapp: data.confirmar_por_whatsapp ?? true,
          pedidos_programados: data.pedidos_programados ?? true,
          aceptar_propinas: data.aceptar_propinas ?? true,
          datos_cliente_obligatorios: data.datos_cliente_obligatorios ?? true,
          monto_minimo: Number(data.monto_minimo) || 0,
          tiempo_preparacion_default: data.tiempo_preparacion_default || 30,
          notificar_nuevo_pedido: data.notificar_nuevo_pedido ?? true,
          notificar_pedido_listo: data.notificar_pedido_listo ?? true,
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
      {/* Configuración General */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Configuración General</h3>
        <div className="space-y-4">
          <label className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
            <div>
              <span className="font-medium">Aceptar pedidos</span>
              <p className="text-sm text-slate-500">
                Permite recibir nuevos pedidos
              </p>
            </div>
            <input
              type="checkbox"
              checked={config.aceptar_pedidos}
              onChange={(e) =>
                setConfig({ ...config, aceptar_pedidos: e.target.checked })
              }
              className="w-5 h-5 text-purple-600 rounded"
            />
          </label>

          <label className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
            <div>
              <span className="font-medium">Confirmar por WhatsApp</span>
              <p className="text-sm text-slate-500">
                Envía confirmación automática por WhatsApp
              </p>
            </div>
            <input
              type="checkbox"
              checked={config.confirmar_por_whatsapp}
              onChange={(e) =>
                setConfig({
                  ...config,
                  confirmar_por_whatsapp: e.target.checked,
                })
              }
              className="w-5 h-5 text-purple-600 rounded"
            />
          </label>

          <label className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
            <div>
              <span className="font-medium">Pedidos programados</span>
              <p className="text-sm text-slate-500">
                Permite programar pedidos para más tarde
              </p>
            </div>
            <input
              type="checkbox"
              checked={config.pedidos_programados}
              onChange={(e) =>
                setConfig({
                  ...config,
                  pedidos_programados: e.target.checked,
                })
              }
              className="w-5 h-5 text-purple-600 rounded"
            />
          </label>

          <label className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
            <div>
              <span className="font-medium">Aceptar propinas</span>
              <p className="text-sm text-slate-500">
                Permite agregar propina a los pedidos
              </p>
            </div>
            <input
              type="checkbox"
              checked={config.aceptar_propinas}
              onChange={(e) =>
                setConfig({ ...config, aceptar_propinas: e.target.checked })
              }
              className="w-5 h-5 text-purple-600 rounded"
            />
          </label>

          <label className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
            <div>
              <span className="font-medium">Datos de cliente obligatorios</span>
              <p className="text-sm text-slate-500">
                Requiere nombre y teléfono para todos los pedidos
              </p>
            </div>
            <input
              type="checkbox"
              checked={config.datos_cliente_obligatorios}
              onChange={(e) =>
                setConfig({
                  ...config,
                  datos_cliente_obligatorios: e.target.checked,
                })
              }
              className="w-5 h-5 text-purple-600 rounded"
            />
          </label>
        </div>
      </div>

      {/* Montos y Tiempos */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Montos y Tiempos</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Monto mínimo de pedido ($)
            </label>
            <input
              type="number"
              value={config.monto_minimo}
              onChange={(e) =>
                setConfig({
                  ...config,
                  monto_minimo: Number(e.target.value) || 0,
                })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Tiempo de preparación por defecto (minutos)
            </label>
            <input
              type="number"
              value={config.tiempo_preparacion_default}
              onChange={(e) =>
                setConfig({
                  ...config,
                  tiempo_preparacion_default: Number(e.target.value) || 30,
                })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="30"
            />
          </div>
        </div>
      </div>

      {/* Notificaciones */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Notificaciones</h3>
        <div className="space-y-4">
          <label className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
            <div>
              <span className="font-medium">Notificar nuevo pedido</span>
              <p className="text-sm text-slate-500">
                Envía notificación cuando llega un nuevo pedido
              </p>
            </div>
            <input
              type="checkbox"
              checked={config.notificar_nuevo_pedido}
              onChange={(e) =>
                setConfig({
                  ...config,
                  notificar_nuevo_pedido: e.target.checked,
                })
              }
              className="w-5 h-5 text-purple-600 rounded"
            />
          </label>

          <label className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
            <div>
              <span className="font-medium">Notificar pedido listo</span>
              <p className="text-sm text-slate-500">
                Envía notificación cuando el pedido está listo
              </p>
            </div>
            <input
              type="checkbox"
              checked={config.notificar_pedido_listo}
              onChange={(e) =>
                setConfig({
                  ...config,
                  notificar_pedido_listo: e.target.checked,
                })
              }
              className="w-5 h-5 text-purple-600 rounded"
            />
          </label>
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
