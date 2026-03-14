"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTenant } from "@/context/TenantContext";
import { Loader2, Download, Upload, AlertTriangle, CheckCircle2 } from "lucide-react";

const TABLES_TO_BACKUP = [
  "config_sucursal",
  "horarios_sucursal",
  "categorias",
  "mesas",
  "metodos_pago",
  "zonas_entrega",
  "ingredientes",
  "clientes",
  "repartidores",
  "productos",
  "variantes_producto",
  "recetas",
  "pedidos",
  "pedido_items",
  "cajas",
  "transacciones_caja",
  "descuentos",
];

export function DatabaseTab() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const { sucursalId } = useTenant();

  const handleBackup = async () => {
    if (!sucursalId) return;
    setLoading(true);
    setStatus({ type: "info", message: "Generando backup..." });

    try {
      const backupData: Record<string, any[]> = {};

      for (const table of TABLES_TO_BACKUP) {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .eq("sucursal_id", sucursalId);

        if (error) throw error;
        backupData[table] = data || [];
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup_mmmsystem_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStatus({ type: "success", message: "Backup descargado con éxito." });
    } catch (error: any) {
      console.error("Error en backup:", error);
      setStatus({ type: "error", message: `Error al generar backup: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !sucursalId) return;

    const confirmRestore = confirm(
      "¿Estás seguro de que deseas restaurar la base de datos? Esto podría duplicar registros si ya existen o causar conflictos si los datos no son compatibles."
    );
    if (!confirmRestore) return;

    setLoading(true);
    setStatus({ type: "info", message: "Restaurando base de datos..." });

    try {
      const text = await file.text();
      const backupData = JSON.parse(text);

      // Restaurar en orden de dependencias
      for (const table of TABLES_TO_BACKUP) {
        const rows = backupData[table];
        if (!rows || rows.length === 0) continue;

        // Limpiar IDs para evitar conflictos de clave primaria si es necesario, 
        // o usar upsert basado en el ID original.
        // Dado que es un backup/restauración del mismo tenant, el upsert debería funcionar.
        
        const { error } = await supabase
          .from(table)
          .upsert(rows, { onConflict: 'id' });

        if (error) {
          console.error(`Error restaurando tabla ${table}:`, error);
          throw new Error(`Error en tabla ${table}: ${error.message}`);
        }
      }

      setStatus({ type: "success", message: "Base de datos restaurada con éxito." });
    } catch (error: any) {
      console.error("Error en restauración:", error);
      setStatus({ type: "error", message: `Error al restaurar: ${error.message}` });
    } finally {
      setLoading(false);
      if (event.target) event.target.value = "";
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Copia de Seguridad y Restauración</h3>
        <p className="text-sm text-gray-500 mb-6">
          Gestiona los datos de tu sucursal. Puedes descargar un respaldo completo o restaurar uno previo.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sección Backup */}
          <div className="p-6 rounded-2xl border border-blue-50 bg-blue-50/30 flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-4">
              <Download size={24} />
            </div>
            <h4 className="font-bold text-gray-900 mb-2">Respaldar Datos</h4>
            <p className="text-sm text-gray-600 mb-6">
              Descarga un archivo JSON con toda la información de tu sucursal (productos, clientes, pedidos, etc).
            </p>
            <button
              onClick={handleBackup}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {loading && status?.message.includes("Generando") ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Download size={20} />
              )}
              Generar Backup
            </button>
          </div>

          {/* Sección Restore */}
          <div className="p-6 rounded-2xl border border-orange-50 bg-orange-50/30 flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 mb-4">
              <Upload size={24} />
            </div>
            <h4 className="font-bold text-gray-900 mb-2">Restaurar Datos</h4>
            <p className="text-sm text-gray-600 mb-6">
              Selecciona un archivo de backup previamente descargado para restaurar la información.
            </p>
            <label className="w-full">
              <div className={`w-full flex items-center justify-center gap-2 bg-orange-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-orange-700 transition-all cursor-pointer ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {loading && status?.message.includes("Restaurando") ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Upload size={20} />
                )}
                Cargar Backup
              </div>
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleRestore}
                disabled={loading}
              />
            </label>
          </div>
        </div>

        {/* Status Message */}
        {status && (
          <div className={`mt-6 p-4 rounded-xl flex items-start gap-3 ${
            status.type === "success" ? "bg-green-50 text-green-700 border border-green-200" :
            status.type === "error" ? "bg-red-50 text-red-700 border border-red-200" :
            "bg-blue-50 text-blue-700 border border-blue-200"
          }`}>
            {status.type === "success" && <CheckCircle2 size={20} className="mt-0.5" />}
            {status.type === "error" && <AlertTriangle size={20} className="mt-0.5" />}
            {status.type === "info" && <Loader2 size={20} className="mt-0.5 animate-spin" />}
            <span className="text-sm font-medium">{status.message}</span>
          </div>
        )}
      </div>

      <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6 flex items-start gap-4">
        <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 shrink-0">
          <AlertTriangle size={20} />
        </div>
        <div>
          <h4 className="font-bold text-amber-900 mb-1">Advertencia Importante</h4>
          <p className="text-sm text-amber-800 leading-relaxed">
            La restauración de datos reemplazará registros existentes con el mismo ID o creará nuevos. 
            Asegúrate de que el archivo de backup sea válido y corresponda a esta sucursal 
            para evitar inconsistencias en la base de datos.
          </p>
        </div>
      </div>
    </div>
  );
}
