"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, X, MapPin, Save, Search, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type Localidad = {
    nombre: string;
    lat: number;
    lng: number;
    display_name: string;
};

export function LocalidadesTab() {
    const [localidades, setLocalidades] = useState<Localidad[]>([]);
    const [sucursalId, setSucursalId] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchInput, setSearchInput] = useState("");
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);

    useEffect(() => { fetchConfig(); }, []);

    async function fetchConfig() {
        const { data: suc } = await supabase.from("sucursales").select("id").limit(1).single();
        if (suc) {
            setSucursalId(suc.id);
            const { data: cfg } = await supabase
                .from("config_sucursal")
                .select("localidades")
                .eq("sucursal_id", suc.id)
                .maybeSingle();
            if (cfg?.localidades) {
                setLocalidades(cfg.localidades);
            }
        }
        setLoading(false);
    }

    async function handleSearch() {
        if (!searchInput.trim()) return;
        setSearching(true);
        setSearchResults([]);
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchInput)}&limit=5&addressdetails=1`,
                { headers: { 'User-Agent': 'MMMSystem/1.0', 'Accept-Language': 'es' } }
            );
            const data = await res.json();
            // Filter to show only cities/towns/villages
            const filtered = data.filter((r: any) =>
                r.type === 'city' || r.type === 'town' || r.type === 'village' ||
                r.type === 'suburb' || r.type === 'administrative' || r.class === 'place' || r.class === 'boundary'
            );
            setSearchResults(filtered.length > 0 ? filtered : data);
        } catch (e) {
            console.error("Error searching:", e);
        } finally {
            setSearching(false);
        }
    }

    function handleAddLocalidad(result: any) {
        const newLoc: Localidad = {
            nombre: result.address?.city || result.address?.town || result.address?.village || result.address?.suburb || result.name || result.display_name.split(",")[0],
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon),
            display_name: result.display_name
        };

        // Avoid duplicates
        if (localidades.some(l => l.nombre === newLoc.nombre && Math.abs(l.lat - newLoc.lat) < 0.01)) {
            alert("Esta localidad ya está agregada.");
            return;
        }

        setLocalidades([...localidades, newLoc]);
        setSearchInput("");
        setSearchResults([]);
    }

    function handleRemoveLocalidad(idx: number) {
        setLocalidades(localidades.filter((_, i) => i !== idx));
    }

    async function handleSave() {
        setSaving(true);
        try {
            const { error } = await supabase
                .from("config_sucursal")
                .upsert({
                    sucursal_id: sucursalId,
                    localidades: localidades,
                } as any, { onConflict: "sucursal_id" });

            if (error) throw error;
            alert("Localidades guardadas correctamente");
        } catch (e: any) {
            console.error("Error saving:", e);
            alert("Error al guardar: " + (e.message || ""));
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <p className="text-gray-400 py-8 text-center text-sm">Cargando...</p>;

    return (
        <div className="pt-6 space-y-6 max-w-lg">
            <div>
                <h3 className="font-semibold text-gray-900 mb-1">Localidades de búsqueda</h3>
                <p className="text-xs text-gray-500">
                    Definí las localidades donde se limitará la búsqueda de direcciones de tus clientes.
                    Al validar una dirección, solo se buscarán calles dentro de estas localidades.
                </p>
            </div>

            {/* Search Bar */}
            <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Search size={14} /> Buscar localidad
                </label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={searchInput}
                        onChange={e => setSearchInput(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleSearch()}
                        placeholder="Ej: Rosario, Santa Fe, Argentina"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                    />
                    <button
                        onClick={handleSearch}
                        disabled={searching || !searchInput.trim()}
                        className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:bg-gray-400 flex items-center gap-2"
                    >
                        {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                        Buscar
                    </button>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                        {searchResults.map((r: any, i: number) => (
                            <button
                                key={i}
                                onClick={() => handleAddLocalidad(r)}
                                className="w-full text-left px-4 py-3 hover:bg-purple-50 transition-colors flex items-center gap-3 border-b border-gray-50 last:border-none"
                            >
                                <MapPin size={14} className="text-purple-500 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{r.display_name}</p>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">{r.type} — {r.class}</p>
                                </div>
                                <Plus size={16} className="text-gray-300" />
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Current Localities */}
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Localidades configuradas ({localidades.length})</label>
                {localidades.length === 0 ? (
                    <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm">
                        No hay localidades configuradas. Agregá al menos una para limitar la búsqueda de direcciones.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {localidades.map((loc, idx) => (
                            <div key={idx} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                                <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-gray-900">{loc.nombre}</p>
                                    <p className="text-[10px] text-gray-400 truncate">{loc.display_name}</p>
                                </div>
                                <button
                                    onClick={() => handleRemoveLocalidad(idx)}
                                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
                <Save size={14} />
                {saving ? "Guardando..." : "Guardar localidades"}
            </button>
        </div>
    );
}
