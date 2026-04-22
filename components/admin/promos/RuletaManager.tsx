"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { 
  Plus, Trash2, Edit3, Save, Search, 
  ToggleLeft, ToggleRight, Gift, 
  Image as ImageIcon, Loader2,
  ChevronDown, ChevronUp, ExternalLink,
  MessageSquare, User, Phone, Calendar,
  RefreshCcw, Filter, X
} from "lucide-react";

interface Ruleta {
  id: string;
  nombre: string;
  activa: boolean;
  whatsapp_negocio: string;
  subtitulo_logo?: string;
  short_code: string;
  whatsapp_emojis: string;
}

interface Segmento {
  id: string;
  ruleta_id: string;
  nombre: string;
  descripcion?: string;
  probabilidad: number;
  color: string;
  activa: boolean;
  imagen_url?: string;
  validez?: string;
}

interface Lead {
  id: string;
  ruleta_id: string;
  nombre_cliente: string;
  whatsapp_cliente: string;
  premio_id: string;
  premio_nombre: string;
  created_at: string;
  ruletas?: { nombre: string };
}

export function RuletaManager({ sucursalId, tenant }: { sucursalId: string, tenant: string }) {
  const [ruletas, setRuletas] = useState<Ruleta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [segments, setSegments] = useState<Segmento[]>([]);
  const [loadingSegments, setLoadingSegments] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Leads states
  const [activeTab, setActiveTab] = useState<"ruletas" | "leads">("ruletas");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [searchLeads, setSearchLeads] = useState("");
  const [sortField, setSortField] = useState<keyof Lead>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    if (sucursalId) {
      fetchRuletas();
      if (activeTab === "leads") fetchLeads();
    }
  }, [sucursalId, activeTab]);

  async function fetchRuletas() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("ruletas")
      .select("*")
      .eq("sucursal_id", sucursalId)
      .order("created_at", { ascending: false });
    
    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') {
        setError("MIGRATION_REQUIRED");
      } else {
        setError(error.message);
      }
    } else {
      setRuletas(data || []);
    }
    setLoading(false);
  }

  async function fetchSegments(ruletaId: string) {
    setLoadingSegments(true);
    const { data } = await supabase
      .from("ruleta_premios")
      .select("*")
      .eq("ruleta_id", ruletaId)
      .order("created_at", { ascending: true });
    setSegments(data || []);
    setLoadingSegments(false);
  }

  async function fetchLeads() {
    setLoadingLeads(true);
    const { data, error } = await supabase
      .from("ruleta_leads")
      .select(`
        *,
        ruletas!inner(id, nombre, sucursal_id)
      `)
      .eq("ruletas.sucursal_id", sucursalId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching leads:", error);
    } else {
      setLeads(data || []);
    }
    setLoadingLeads(false);
  }

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm("¿Resetear a este participante? Podrá volver a girar la ruleta.")) return;
    const { error } = await supabase.from("ruleta_leads").delete().eq("id", leadId);
    if (!error) {
      setLeads(leads.filter(l => l.id !== leadId));
    }
  };

  const handleEdit = (ruleta: Ruleta) => {
    setEditingId(ruleta.id);
    fetchSegments(ruleta.id);
  };

  const handleAddRuleta = async () => {
    const slug = Math.random().toString(36).substring(2, 8);
    const newRuleta = {
      sucursal_id: sucursalId,
      nombre: "Nueva Ruleta",
      activa: true,
      whatsapp_negocio: "",
      short_code: slug,
      whatsapp_emojis: "🎡🎁"
    };

    const { data, error } = await supabase.from("ruletas").insert(newRuleta).select().single();
    if (data) {
      setRuletas([data, ...ruletas]);
      handleEdit(data);
    }
  };

  const handleSaveRuleta = async (id: string, updates: Partial<Ruleta>) => {
    setSaving(true);
    await supabase.from("ruletas").update(updates).eq("id", id);
    setRuletas(ruletas.map(r => r.id === id ? { ...r, ...updates } : r));
    setSaving(false);
  };

  const handleDeleteRuleta = async (id: string) => {
    if (!confirm("¿Eliminar esta ruleta y sus premios?")) return;
    await supabase.from("ruletas").delete().eq("id", id);
    setRuletas(ruletas.filter(r => r.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const handleAddSegment = async () => {
    if (!editingId) return;
    const newSeg = {
      ruleta_id: editingId,
      nombre: "Premio",
      probabilidad: 10,
      color: "#" + Math.floor(Math.random()*16777215).toString(16),
      activa: true
    };
    const { data } = await supabase.from("ruleta_premios").insert(newSeg).select().single();
    if (data) setSegments([...segments, data]);
  };

  const handleUpdateSegment = async (id: string, updates: Partial<Segmento>) => {
    await supabase.from("ruleta_premios").update(updates).eq("id", id);
    setSegments(segments.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleDeleteSegment = async (id: string) => {
    await supabase.from("ruleta_premios").delete().eq("id", id);
    setSegments(segments.filter(s => s.id !== id));
  };

  const handleUploadImage = async (segmentId: string, file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${editingId}/${segmentId}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('promos')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      alert("Error subiendo imagen. ¿El bucket 'promos' existe?");
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('promos').getPublicUrl(filePath);
    handleUpdateSegment(segmentId, { imagen_url: publicUrl });
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-purple-600" /></div>;

  if (error === "MIGRATION_REQUIRED") {
    return (
      <div className="bg-red-50 border border-red-200 rounded-3xl p-8 text-center animate-in fade-in zoom-in duration-300">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
          <Gift size={32} />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Se requiere configuración de base de datos</h3>
        <p className="text-gray-600 max-w-md mx-auto mb-6 text-sm">
          Faltan las tablas de la ruleta en tu base de datos de Supabase. 
          Por favor, ejecutá el script de migración manual para activar esta funcionalidad.
        </p>
        <div className="flex justify-center gap-3">
          <button 
            onClick={fetchRuletas}
            className="bg-gray-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-800 transition-all"
          >
            Reintentar conexión
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 text-center">
        <p className="text-amber-800 font-bold mb-4">Error: {error}</p>
        <button onClick={fetchRuletas} className="bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-bold">Reintentar</button>
      </div>
    );
  }

  // Sorting and Filtering Leads
  const filteredLeads = leads
    .filter(l => 
      l.nombre_cliente.toLowerCase().includes(searchLeads.toLowerCase()) ||
      l.whatsapp_cliente.includes(searchLeads) ||
      l.premio_nombre?.toLowerCase().includes(searchLeads.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortField] || "";
      const bVal = b[sortField] || "";
      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

  const toggleSort = (field: keyof Lead) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };
  return (
    <div className="space-y-6">
      {/* Sub-tabs for Ruleta Manager */}
      <div className="flex gap-4 border-b border-gray-200">
        <button 
          onClick={() => setActiveTab("ruletas")}
          className={`pb-3 text-sm font-bold transition-all border-b-2 ${activeTab === "ruletas" ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          Campañas
        </button>
        <button 
          onClick={() => setActiveTab("leads")}
          className={`pb-3 text-sm font-bold transition-all border-b-2 ${activeTab === "leads" ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          Participantes y Ganadores
        </button>
      </div>

      {activeTab === "ruletas" ? (
        <>
          {/* List of Roulettes */}
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-200">
        <div>
          <h3 className="font-bold text-gray-900">Mis Ruletas</h3>
          <p className="text-xs text-gray-500">Gestiona múltiples campañas interactivas</p>
        </div>
        <button 
          onClick={handleAddRuleta}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-purple-700 transition-all shadow-sm"
        >
          <Plus size={16} /> Nueva Ruleta
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {ruletas.map(r => (
          <div key={r.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:border-purple-200 transition-colors">
            <div className={`p-4 flex items-center justify-between ${editingId === r.id ? 'bg-purple-50/50' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
                  <Gift size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">{r.nombre}</h4>
                  <p className="text-xs text-gray-400 font-mono">/p/{r.short_code}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a 
                  href={`/${tenant}/p/${r.short_code}`} 
                  target="_blank" 
                  className="p-2 text-gray-400 hover:text-purple-600 transition-colors"
                  title="Ver vista pública"
                >
                  <ExternalLink size={18} />
                </a>
                <button 
                  onClick={() => handleEdit(r)}
                  className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                >
                  <Edit3 size={18} />
                </button>
                <button 
                  onClick={() => handleDeleteRuleta(r.id)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            {/* Editing Section */}
            {editingId === r.id && (
              <div className="p-6 border-t border-gray-100 bg-gray-50/30 animate-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {/* General Config */}
                  <div className="space-y-4">
                    <h5 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Gift size={12} /> Configuración General
                    </h5>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">Nombre de la campaña</label>
                        <input 
                          type="text" 
                          defaultValue={r.nombre}
                          onBlur={(e) => handleSaveRuleta(r.id, { nombre: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-400 transition-all font-medium"
                        />
                      </div>
                      <div className="flex gap-3">
                         <div className="flex-1">
                            <label className="text-xs font-bold text-gray-500 block mb-1">WhatsApp del negocio</label>
                            <input 
                              type="text" 
                              placeholder="Ej: 5491122334455"
                              defaultValue={r.whatsapp_negocio}
                              onBlur={(e) => handleSaveRuleta(r.id, { whatsapp_negocio: e.target.value })}
                              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-400 transition-all"
                            />
                         </div>
                         <div className="w-1/3">
                            <label className="text-xs font-bold text-gray-500 block mb-1">Emojis reclamo</label>
                            <input 
                              type="text" 
                              defaultValue={r.whatsapp_emojis}
                              onBlur={(e) => handleSaveRuleta(r.id, { whatsapp_emojis: e.target.value })}
                              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-400 transition-all text-center"
                            />
                         </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">Subtítulo debajo del logo</label>
                        <input 
                          type="text" 
                          placeholder="Ej: Girar y ganar"
                          defaultValue={r.subtitulo_logo}
                          onBlur={(e) => handleSaveRuleta(r.id, { subtitulo_logo: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-400 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Status & Link */}
                  <div className="space-y-4">
                    <h5 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <ExternalLink size={12} /> Estado y Acceso
                    </h5>
                    <div className="p-4 bg-white border border-gray-200 rounded-2xl space-y-4">
                       <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-gray-700">Ruleta Activa</span>
                          <button onClick={() => handleSaveRuleta(r.id, { activa: !r.activa })}>
                            {r.activa ? <ToggleRight className="text-green-500" size={32} /> : <ToggleLeft className="text-gray-300" size={32} />}
                          </button>
                       </div>
                       <div className="pt-4 border-t border-gray-50">
                          <label className="text-[10px] font-black text-gray-400 uppercase block mb-2">Enlace corto (Short Code)</label>
                          <div className="flex items-center gap-2">
                             <div className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs font-mono text-purple-600 truncate">
                                {window.location.origin}/{tenant}/p/{r.short_code}
                             </div>
                             <button 
                               onClick={() => navigator.clipboard.writeText(`${window.location.origin}/${tenant}/p/${r.short_code}`)}
                               className="text-xs font-bold text-purple-600 hover:underline"
                             >
                               Copiar
                             </button>
                          </div>
                          <p className="text-[10px] text-gray-400 mt-2">Este es el link que debés compartir o poner en tu perfil.</p>
                       </div>
                    </div>
                  </div>
                </div>

                {/* Segments Editor */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Gift size={12} /> Segmentos de Premios ({segments.length})
                    </h5>
                    <button 
                      onClick={handleAddSegment}
                      className="text-xs font-bold text-purple-600 flex items-center gap-1 hover:bg-purple-50 px-2 py-1 rounded-lg transition-colors"
                    >
                      <Plus size={14} /> Agregar Segmento
                    </button>
                  </div>

                  {loadingSegments ? (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin text-purple-300" /></div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {segments.map((seg, idx) => (
                        <div key={seg.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs relative group animate-in zoom-in-95 duration-200">
                          <button 
                            onClick={() => handleDeleteSegment(seg.id)}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-50 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border border-red-100 shadow-sm z-10"
                          >
                            <Trash2 size={12} />
                          </button>
                          
                          <div className="space-y-3">
                            <div className="flex gap-2">
                              {/* Color Picker (simple text input for now) */}
                              <div 
                                className="w-10 h-10 rounded-lg shrink-0 cursor-pointer border border-gray-100 shadow-inner"
                                style={{ backgroundColor: seg.color }}
                                onClick={() => {
                                  const c = prompt("Ingresá color hex (ej: #FF0000)", seg.color);
                                  if (c) handleUpdateSegment(seg.id, { color: c });
                                }}
                              />
                              <input 
                                type="text" 
                                placeholder="Nombre del premio"
                                defaultValue={seg.nombre}
                                onBlur={(e) => handleUpdateSegment(seg.id, { nombre: e.target.value })}
                                className="flex-1 bg-gray-50/50 border-none px-2 rounded-lg text-sm font-bold outline-none focus:ring-1 focus:ring-purple-200"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                               <div>
                                  <label className="text-[10px] font-bold text-gray-400 block mb-0.5">Probabilidad (1-100)</label>
                                  <input 
                                    type="number" 
                                    defaultValue={seg.probabilidad}
                                    onBlur={(e) => handleUpdateSegment(seg.id, { probabilidad: parseInt(e.target.value) || 1 })}
                                    className="w-full bg-gray-50 border-none px-2 py-1.5 rounded-lg text-xs font-mono"
                                  />
                               </div>
                               <div>
                                  <label className="text-[10px] font-bold text-gray-400 block mb-0.5">Vencimiento / Validez</label>
                                  <input 
                                    type="text" 
                                    placeholder="24hs"
                                    defaultValue={seg.validez}
                                    onBlur={(e) => handleUpdateSegment(seg.id, { validez: e.target.value })}
                                    className="w-full bg-gray-50 border-none px-2 py-1.5 rounded-lg text-xs"
                                  />
                               </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                               <div className="flex gap-2">
                                  <label className="cursor-pointer text-gray-400 hover:text-purple-600 transition-colors">
                                    <ImageIcon size={14} />
                                    <input 
                                      type="file" 
                                      className="hidden" 
                                      accept="image/*"
                                      onChange={(e) => e.target.files?.[0] && handleUploadImage(seg.id, e.target.files[0])}
                                    />
                                  </label>
                                  {seg.imagen_url && (
                                    <span className="text-[10px] text-green-500 font-bold uppercase ring-1 ring-green-100 px-1 rounded">Img OK</span>
                                  )}
                               </div>
                               <button 
                                 onClick={() => handleUpdateSegment(seg.id, { activa: !seg.activa })}
                                 className={`text-[10px] font-bold px-2 py-0.5 rounded ${seg.activa ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}
                               >
                                 {seg.activa ? 'ACTIVO' : 'PAUSADO'}
                               </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {ruletas.length === 0 && (
          <div className="bg-white border border-dashed border-gray-300 rounded-3xl p-12 text-center">
            <Gift size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">Aún no tenés ruletas creadas</p>
            <button 
              onClick={handleAddRuleta}
              className="mt-4 text-purple-600 font-bold hover:underline"
            >
              Creá tu primera ruleta haciendo click acá
            </button>
          </div>
        )}
      </div>
      </>
      ) : (
        /* Leads View */
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
           {/* Search and Header */}
           <div className="bg-white p-5 rounded-2xl border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                 <input 
                   type="text" 
                   placeholder="Buscar por nombre, WhatsApp o premio..."
                   value={searchLeads}
                   onChange={e => setSearchLeads(e.target.value)}
                   className="w-full bg-gray-50 border border-gray-100 rounded-xl py-2.5 pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-purple-100 transition-all"
                 />
                 {searchLeads && (
                   <button onClick={() => setSearchLeads("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                     <X size={14} />
                   </button>
                 )}
              </div>
              <div className="flex items-center gap-2">
                 <button 
                   onClick={fetchLeads} 
                   disabled={loadingLeads}
                   className="p-2.5 bg-gray-50 text-gray-500 rounded-xl hover:bg-gray-100 transition-colors"
                 >
                   <RefreshCcw size={18} className={loadingLeads ? 'animate-spin' : ''} />
                 </button>
                 <div className="bg-purple-50 text-purple-700 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest">
                   {filteredLeads.length} Participantes
                 </div>
              </div>
           </div>

           {/* Leads Table */}
           <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100">
                      <th onClick={() => toggleSort('nombre_cliente')} className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:text-purple-600 transition-colors">
                        <div className="flex items-center gap-1">
                          Participante {sortField === 'nombre_cliente' && (sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                        </div>
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">WhatsApp</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Campaña</th>
                      <th onClick={() => toggleSort('premio_nombre')} className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:text-purple-600 transition-colors">
                        <div className="flex items-center gap-1">
                          Premio Ganado {sortField === 'premio_nombre' && (sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                        </div>
                      </th>
                      <th onClick={() => toggleSort('created_at')} className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:text-purple-600 transition-colors">
                        <div className="flex items-center gap-1">
                          Fecha {sortField === 'created_at' && (sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                        </div>
                      </th>
                      <th className="px-6 py-4 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-gray-50/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-bold text-xs uppercase">
                              {lead.nombre_cliente.charAt(0)}
                            </div>
                            <span className="text-sm font-bold text-gray-900">{lead.nombre_cliente}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <a 
                            href={`https://wa.me/${lead.whatsapp_cliente}`} 
                            target="_blank"
                            className="text-xs font-medium text-gray-600 hover:text-green-600 flex items-center gap-1.5"
                          >
                            <Phone size={12} /> {lead.whatsapp_cliente}
                          </a>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded uppercase">
                            {lead.ruletas?.nombre || 'Ruleta'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-sm">
                             <Gift size={14} className="text-purple-500" />
                             <span className="font-black text-gray-900 uppercase tracking-tight">{lead.premio_nombre || 'Sin premio'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-700 font-medium">{new Date(lead.created_at).toLocaleDateString()}</span>
                            <span className="text-[10px] text-gray-400">{new Date(lead.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => handleDeleteLead(lead.id)}
                            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            title="Resetear participante (Podrá girar de nuevo)"
                          >
                            <RefreshCcw size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredLeads.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic text-sm">
                          {searchLeads ? 'No se encontraron resultados para tu búsqueda' : 'Aún no hay participantes en esta sucursal'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
