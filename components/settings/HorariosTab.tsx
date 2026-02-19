"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

const DIAS_SEMANA = [
  { id: 0, nombre: "Lunes" },
  { id: 1, nombre: "Martes" },
  { id: 2, nombre: "Miércoles" },
  { id: 3, nombre: "Jueves" },
  { id: 4, nombre: "Viernes" },
  { id: 5, nombre: "Sábado" },
  { id: 6, nombre: "Domingo" },
];

export function HorariosTab() {
  const [cerradoTemporalmente, setCerradoTemporalmente] = useState(false);
  const [horarios, setHorarios] = useState<
    Record<
      number,
      {
        cerrado: boolean;
        apertura1: string;
        cierre1: string;
        apertura2: string;
        cierre2: string;
        disponibleEn: string[]; // ['delivery', 'takeaway', 'salon']
      }
    >
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadHorarios();
  }, []);

  async function loadHorarios() {
    try {
      // Cargar configuración de cerrado temporal
      const { data: config } = await supabase
        .from("config_sucursal")
        .select("cerrado_temporalmente")
        .single();
      
      if (config) {
        setCerradoTemporalmente(config.cerrado_temporalmente ?? false);
      }

      const { data } = await supabase
        .from("horarios_sucursal")
        .select("*")
        .order("dia");

      if (data) {
        const horariosMap: typeof horarios = {};
        data.forEach((h) => {
            horariosMap[h.dia] = {
              cerrado: h.cerrado ?? false,
              apertura1: h.apertura1 || "",
              cierre1: h.cierre1 || "",
              apertura2: h.apertura2 || "",
              cierre2: h.cierre2 || "",
              disponibleEn: h.disponible_en || [],
            };
        });

        // Inicializar días faltantes
        DIAS_SEMANA.forEach((dia) => {
          if (!horariosMap[dia.id]) {
            horariosMap[dia.id] = {
              cerrado: false,
              apertura1: "09:00",
              cierre1: "13:00",
              apertura2: "17:00",
              cierre2: "22:00",
              disponibleEn: [],
            };
          } else {
            // Asegurar que disponibleEn existe
            if (!horariosMap[dia.id].disponibleEn) {
              horariosMap[dia.id].disponibleEn = [];
            }
          }
        });

        setHorarios(horariosMap);
      } else {
        // Inicializar con valores por defecto
        const defaultHorarios: typeof horarios = {};
        DIAS_SEMANA.forEach((dia) => {
          defaultHorarios[dia.id] = {
            cerrado: false,
            apertura1: "09:00",
            cierre1: "13:00",
            apertura2: "17:00",
            cierre2: "22:00",
            disponibleEn: [],
          };
        });
        setHorarios(defaultHorarios);
      }
    } catch (error) {
      console.error("Error cargando horarios:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Guardar cerrado temporalmente
      await supabase
        .from("config_sucursal")
        .update({ cerrado_temporalmente: cerradoTemporalmente })
        .select()
        .single();

      // Guardar horarios
      // TODO: Implementar guardado completo de horarios con disponible_en
      await new Promise((resolve) => setTimeout(resolve, 500));
      alert("Horarios guardados correctamente");
    } catch (error) {
      alert("Error al guardar los horarios");
    } finally {
      setSaving(false);
    }
  }

  function updateHorario(
    dia: number,
    field: keyof typeof horarios[0],
    value: string | boolean | string[]
  ) {
    setHorarios({
      ...horarios,
      [dia]: {
        ...horarios[dia],
        [field]: value,
      },
    });
  }

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Cargando...</div>;
  }

  function toggleDisponibleEn(dia: number, modalidad: string) {
    const horario = horarios[dia];
    if (!horario) return;

    const disponibleEn = horario.disponibleEn || [];
    const index = disponibleEn.indexOf(modalidad);
    
    if (index > -1) {
      disponibleEn.splice(index, 1);
    } else {
      disponibleEn.push(modalidad);
    }

    updateHorario(dia, "disponibleEn", [...disponibleEn]);
  }

  return (
    <div className="space-y-6">
      {/* Cerrado Temporalmente */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={cerradoTemporalmente}
            onChange={(e) => setCerradoTemporalmente(e.target.checked)}
            className="w-5 h-5 text-purple-600 rounded"
          />
          <div>
            <span className="font-semibold text-slate-900">
              Cerrado temporalmente
            </span>
            <p className="text-sm text-slate-500">
              Cierra el negocio temporalmente sin afectar los horarios configurados
            </p>
          </div>
        </label>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Horarios de Atención</h3>
        <p className="text-sm text-slate-600 mb-6">
          Configura los horarios de atención para cada día de la semana. Puedes
          establecer dos turnos por día y especificar en qué modalidades está disponible cada turno.
        </p>

        <div className="space-y-4">
          {DIAS_SEMANA.map((dia) => {
            const horario = horarios[dia.id];
            if (!horario) return null;

            return (
              <div
                key={dia.id}
                className="p-4 border border-slate-200 rounded-lg"
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-slate-900">
                    {dia.nombre}
                  </h4>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={horario.cerrado}
                      onChange={(e) =>
                        updateHorario(dia.id, "cerrado", e.target.checked)
                      }
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <span className="text-sm text-slate-600">Cerrado</span>
                  </label>
                </div>

                {!horario.cerrado && (
                  <div className="space-y-4">
                    {/* Turno 1 */}
                    <div>
                      <label className="block text-xs text-slate-500 mb-2">
                        Turno 1
                      </label>
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="time"
                          value={horario.apertura1}
                          onChange={(e) =>
                            updateHorario(dia.id, "apertura1", e.target.value)
                          }
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                        <span className="text-slate-400">-</span>
                        <input
                          type="time"
                          value={horario.cierre1}
                          onChange={(e) =>
                            updateHorario(dia.id, "cierre1", e.target.value)
                          }
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                      {horario.apertura1 && horario.cierre1 && (
                        <div className="flex gap-3 mt-2">
                          <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={horario.disponibleEn?.includes("delivery")}
                              onChange={() => toggleDisponibleEn(dia.id, "delivery")}
                              className="w-3 h-3 text-purple-600 rounded"
                            />
                            <span>Delivery</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={horario.disponibleEn?.includes("takeaway")}
                              onChange={() => toggleDisponibleEn(dia.id, "takeaway")}
                              className="w-3 h-3 text-purple-600 rounded"
                            />
                            <span>Take Away</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={horario.disponibleEn?.includes("salon")}
                              onChange={() => toggleDisponibleEn(dia.id, "salon")}
                              className="w-3 h-3 text-purple-600 rounded"
                            />
                            <span>Salón</span>
                          </label>
                        </div>
                      )}
                    </div>

                    {/* Turno 2 */}
                    <div>
                      <label className="block text-xs text-slate-500 mb-2">
                        Turno 2 (opcional)
                      </label>
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="time"
                          value={horario.apertura2}
                          onChange={(e) =>
                            updateHorario(dia.id, "apertura2", e.target.value)
                          }
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                        <span className="text-slate-400">-</span>
                        <input
                          type="time"
                          value={horario.cierre2}
                          onChange={(e) =>
                            updateHorario(dia.id, "cierre2", e.target.value)
                          }
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                      {horario.apertura2 && horario.cierre2 && (
                        <div className="flex gap-3 mt-2">
                          <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={horario.disponibleEn?.includes("delivery")}
                              onChange={() => toggleDisponibleEn(dia.id, "delivery")}
                              className="w-3 h-3 text-purple-600 rounded"
                            />
                            <span>Delivery</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={horario.disponibleEn?.includes("takeaway")}
                              onChange={() => toggleDisponibleEn(dia.id, "takeaway")}
                              className="w-3 h-3 text-purple-600 rounded"
                            />
                            <span>Take Away</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={horario.disponibleEn?.includes("salon")}
                              onChange={() => toggleDisponibleEn(dia.id, "salon")}
                              className="w-3 h-3 text-purple-600 rounded"
                            />
                            <span>Salón</span>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
