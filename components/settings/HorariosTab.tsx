"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTenant } from "@/context/TenantContext";
import { Clock, AlertCircle, Save, Check } from "lucide-react";

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
  const { sucursalId } = useTenant();

  useEffect(() => {
    if (sucursalId) loadHorarios();
  }, [sucursalId]);

  async function loadHorarios() {
    if (!sucursalId) return;
    try {
      const { data: config } = await supabase
        .from("config_sucursal")
        .select("cerrado_temporalmente")
        .eq("sucursal_id", sucursalId)
        .single();

      if (config) {
        setCerradoTemporalmente(config.cerrado_temporalmente ?? false);
      }

      const { data } = await supabase
        .from("horarios_sucursal")
        .select("*")
        .eq("sucursal_id", sucursalId)
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
            if (!horariosMap[dia.id].disponibleEn) {
              horariosMap[dia.id].disponibleEn = [];
            }
          }
        });

        setHorarios(horariosMap);
      } else {
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
    if (!sucursalId) return;
    setSaving(true);
    try {
      await supabase
        .from("config_sucursal")
        .update({ cerrado_temporalmente: cerradoTemporalmente })
        .eq("sucursal_id", sucursalId);

      const horariosArray = Object.entries(horarios).map(([diaStr, h]) => ({
        sucursal_id: sucursalId,
        dia: parseInt(diaStr, 10),
        cerrado: h.cerrado,
        apertura1: h.apertura1 || null,
        cierre1: h.cierre1 || null,
        apertura2: h.apertura2 || null,
        cierre2: h.cierre2 || null,
        disponible_en: h.disponibleEn || [],
      }));

      const { error: horariosError } = await supabase
        .from("horarios_sucursal")
        .upsert(horariosArray, {
          onConflict: "sucursal_id, dia"
        });

      if (horariosError) throw horariosError;

      alert("Horarios guardados correctamente");
    } catch (error: any) {
      console.error(error);
      alert("Error al guardar los horarios: " + (error.message || ""));
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

  function toggleDisponibleEn(dia: number, modalidad: string) {
    const horario = horarios[dia];
    if (!horario) return;

    const disponibleEn = [...(horario.disponibleEn || [])];
    const index = disponibleEn.indexOf(modalidad);

    if (index > -1) {
      disponibleEn.splice(index, 1);
    } else {
      disponibleEn.push(modalidad);
    }

    updateHorario(dia, "disponibleEn", disponibleEn);
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-400 animate-pulse font-medium">Cargando horarios...</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Cerrado Temporalmente - Compact Header Card */}
      <div className={`p-4 rounded-2xl border transition-all duration-300 ${cerradoTemporalmente ? 'bg-red-50 border-red-200' : 'bg-[#fff] border-slate-200'}`}>
        <label className="flex items-center gap-4 cursor-pointer">
          <div className={`p-2 rounded-xl ${cerradoTemporalmente ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
            <AlertCircle size={20} />
          </div>
          <div className="flex-1">
            <span className={`font-bold block ${cerradoTemporalmente ? 'text-red-700' : 'text-slate-900'}`}>
              Cerrado temporalmente
            </span>
            <p className="text-xs text-slate-500">
              Cierra el negocio inmediatamente sin cambiar la configuración semanal.
            </p>
          </div>
          <div className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-600 focus:ring-offset-2 bg-gray-200"
               style={{ backgroundColor: cerradoTemporalmente ? '#7B1FA2' : '#e2e8f0' }}
               onClick={() => setCerradoTemporalmente(!cerradoTemporalmente)}>
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${cerradoTemporalmente ? 'translate-x-5' : 'translate-x-0'}`} />
          </div>
        </label>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Clock size={20} className="text-[#7B1FA2]" />
              Horarios de Atención
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Define los turnos de apertura y modalidades disponibles por día.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#7B1FA2] text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all shadow-md shadow-purple-100"
          >
            {saving ? (
              "Guardando..."
            ) : (
              <>
                <Save size={16} />
                Guardar cambios
              </>
            )}
          </button>
        </div>

        <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {DIAS_SEMANA.map((dia) => {
            const horario = horarios[dia.id];
            if (!horario) return null;

            return (
              <div
                key={dia.id}
                className={`group p-4 border rounded-2xl transition-all duration-300 ${
                  horario.cerrado 
                    ? "bg-slate-50 border-slate-100 opacity-80" 
                    : "bg-white border-slate-200 hover:border-purple-200 hover:shadow-md"
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className={`font-bold transition-colors ${horario.cerrado ? 'text-slate-400' : 'text-slate-900'}`}>
                    {dia.nombre}
                  </h4>
                  <label className="flex items-center gap-2 cursor-pointer py-1 px-3 rounded-lg hover:bg-slate-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={horario.cerrado}
                      onChange={(e) =>
                        updateHorario(dia.id, "cerrado", e.target.checked)
                      }
                      className="w-4 h-4 text-purple-600 rounded border-slate-300 transition-all"
                    />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cerrado</span>
                  </label>
                </div>

                {!horario.cerrado && (
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">
                          Primer Turno
                        </label>
                        <div className="flex items-center gap-1.5 p-1 bg-slate-50 rounded-xl border border-slate-100">
                          <input
                            type="time"
                            value={horario.apertura1}
                            onChange={(e) => updateHorario(dia.id, "apertura1", e.target.value)}
                            className="w-full bg-transparent px-2 py-1 text-sm font-semibold text-slate-700 outline-none"
                          />
                          <span className="text-slate-300 text-xs">-</span>
                          <input
                            type="time"
                            value={horario.cierre1}
                            onChange={(e) => updateHorario(dia.id, "cierre1", e.target.value)}
                            className="w-full bg-transparent px-2 py-1 text-sm font-semibold text-slate-700 outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">
                          Segundo Turno
                        </label>
                        <div className="flex items-center gap-1.5 p-1 bg-slate-50 rounded-xl border border-slate-100">
                          <input
                            type="time"
                            value={horario.apertura2}
                            onChange={(e) => updateHorario(dia.id, "apertura2", e.target.value)}
                            className="w-full bg-transparent px-2 py-1 text-sm font-semibold text-slate-700 outline-none"
                          />
                          <span className="text-slate-300 text-xs">-</span>
                          <input
                            type="time"
                            value={horario.cierre2}
                            onChange={(e) => updateHorario(dia.id, "cierre2", e.target.value)}
                            className="w-full bg-transparent px-2 py-1 text-sm font-semibold text-slate-700 outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-50">
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">
                        Modalidades habilitadas
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {['delivery', 'takeaway', 'salon'].map((mod) => (
                          <button
                            key={mod}
                            onClick={() => toggleDisponibleEn(dia.id, mod)}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                              horario.disponibleEn?.includes(mod)
                                ? "bg-purple-100 border-purple-200 text-[#7B1FA2]"
                                : "bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-300"
                            }`}
                          >
                            {mod === 'delivery' ? 'Delivery' : mod === 'takeaway' ? 'Take Away' : 'Salón'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Save Button (Sticky Bottom on Mobile) */}
      <div className="md:hidden fixed bottom-4 left-4 right-4 z-50">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[#7B1FA2] text-white rounded-2xl font-bold shadow-xl active:scale-95 transition-all"
        >
          {saving ? "Guardando..." : <><Save size={20} /> Guardar Cambios</>}
        </button>
      </div>
    </div>
  );
}
