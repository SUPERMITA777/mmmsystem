"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Search, Download, MapPin, ChevronLeft, ChevronRight, ExternalLink, MessageCircle, Calendar, Filter, ChevronUp, ChevronDown, Edit3, Users, AlertTriangle } from "lucide-react";
import { useTenant } from "@/context/TenantContext";
import ClienteDetailModal from "@/components/admin/ClienteDetailModal";
import { getStartOfDayArgentina, getEndOfDayArgentina } from "@/lib/dateUtils";
import HeatmapModal from "@/components/admin/HeatmapModal";

type Cliente = {
    id: string;
    nombre: string;
    telefono: string;
    email: string;
    direccion: string;
    total_pedidos: number;
    total_gastado: number;
};

// Normalize phone number: strips non-digits, removes leading country codes (549, 54, etc.)
function normalizePhone(phone: string): string {
    let digits = phone.replace(/\D/g, '');
    // Remove Argentina country code variations
    if (digits.startsWith('549')) digits = digits.slice(3);
    else if (digits.startsWith('54')) digits = digits.slice(2);
    // Remove leading 0 for area codes like 011 -> 11
    if (digits.startsWith('0')) digits = digits.slice(1);
    // Remove leading 15 (old mobile prefix)
    if (digits.startsWith('15') && digits.length > 8) digits = digits.slice(2);
    return digits;
}

export default function ClientesPage() {
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState("");
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [total, setTotal] = useState(0);
    const { sucursalId } = useTenant();

    // Sorting State
    const [sortColumn, setSortColumn] = useState<string>("total_pedidos");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
    
    const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
    const [showHeatmap, setShowHeatmap] = useState(false);

    // WhatsApp message template
    const [waTemplate, setWaTemplate] = useState('¡Hola {nombre}! Tenemos una promo para vos...');
    const [showTemplateEditor, setShowTemplateEditor] = useState(false);

    // Phone dedup
    const [showDuplicates, setShowDuplicates] = useState(false);

    // Loyalty Filters
    const [loyaltyFilter, setLoyaltyFilter] = useState<"todos" | "con_compras" | "sin_compras">("todos");
    const [fechaDesde, setFechaDesde] = useState<string>(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toISOString().split("T")[0];
    });
    const [fechaHasta, setFechaHasta] = useState<string>(new Date().toISOString().split("T")[0]);
    const [productoFiltro, setProductoFiltro] = useState<string[]>([]);
    const [listaProductos, setListaProductos] = useState<string[]>([]);

    useEffect(() => {
        if (sucursalId) {
            fetchClientes();
            fetchListaProductos();
        }
    }, [page, perPage, busqueda, sucursalId, loyaltyFilter, fechaDesde, fechaHasta, productoFiltro, sortColumn, sortDirection]);

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === "asc" ? "desc" : "asc");
        } else {
            setSortColumn(column);
            setSortDirection("desc");
        }
        setPage(1);
    };

    const SortIcon = ({ column }: { column: string }) => {
        if (sortColumn !== column) return <ChevronDown size={12} className="opacity-20 flex-shrink-0" />;
        return sortDirection === "asc" ? <ChevronUp size={12} className="text-purple-600 flex-shrink-0" /> : <ChevronDown size={12} className="text-purple-600 flex-shrink-0" />;
    };

    async function fetchListaProductos() {
        if (!sucursalId) return;
        const { data } = await supabase
            .from("productos")
            .select("nombre")
            .eq("sucursal_id", sucursalId)
            .eq("activo", true)
            .order("nombre");
        
        if (data) {
            const unique = Array.from(new Set(data.map(p => p.nombre)));
            setListaProductos(unique);
        }
    }

    async function fetchClientes() {
        if (!sucursalId) return;
        setLoading(true);

        try {
            let filteredClientPhones: string[] | null = null;
            let filteredClientIds: string[] | null = null;

            // Handle Loyalty filtering
            if (loyaltyFilter !== "todos") {
                let pQuery = supabase
                    .from("pedidos")
                    .select("cliente_id, cliente_telefono, pedido_items(nombre_producto)")
                    .eq("sucursal_id", sucursalId);

                if (fechaDesde) {
                    pQuery = pQuery.gte("created_at", getStartOfDayArgentina(fechaDesde));
                }
                if (fechaHasta) {
                    pQuery = pQuery.lte("created_at", getEndOfDayArgentina(fechaHasta));
                }

                const { data: pedidosData } = await pQuery;

                if (pedidosData) {
                    let filteredData = pedidosData;
                    
                    // Filter by products if array is not empty
                    if (productoFiltro.length > 0) {
                        filteredData = pedidosData.filter(p => 
                            p.pedido_items?.some((item: any) => productoFiltro.includes(item.nombre_producto))
                        );
                    }

                    filteredClientPhones = Array.from(new Set(filteredData.map(p => p.cliente_telefono).filter(Boolean))) as string[];
                    filteredClientIds = Array.from(new Set(filteredData.map(p => p.cliente_id).filter(Boolean))) as string[];
                } else {
                    filteredClientPhones = [];
                    filteredClientIds = [];
                }
            }

            let query = supabase
                .from("clientes")
                .select("*", { count: "exact" })
                .eq("sucursal_id", sucursalId)
                .order(sortColumn, { ascending: sortDirection === "asc" })
                .range((page - 1) * perPage, page * perPage - 1);

            if (busqueda) {
                query = query.ilike("nombre", `%${busqueda}%`);
            }

            if (loyaltyFilter === "con_compras") {
                if (filteredClientIds && filteredClientPhones) {
                    const idFilter = filteredClientIds.length > 0 ? `id.in.(${filteredClientIds.map(id => `"${id}"`).join(",")})` : "";
                    const phoneFilter = filteredClientPhones.length > 0 ? `telefono.in.(${filteredClientPhones.map(p => `"${p}"`).join(",")})` : "";
                    
                    if (idFilter && phoneFilter) {
                        query = query.or(`${idFilter},${phoneFilter}`);
                    } else if (idFilter) {
                        query = query.or(idFilter);
                    } else if (phoneFilter) {
                        query = query.or(phoneFilter);
                    } else {
                        setClientes([]);
                        setTotal(0);
                        setLoading(false);
                        return;
                    }
                } else {
                    setClientes([]);
                    setTotal(0);
                    setLoading(false);
                    return;
                }
            } else if (loyaltyFilter === "sin_compras") {
                if (filteredClientIds && filteredClientIds.length > 0) {
                    query = query.not("id", "in", `(${filteredClientIds.map(id => `"${id}"`).join(",")})`);
                }
                if (filteredClientPhones && filteredClientPhones.length > 0) {
                    query = query.not("telefono", "in", `(${filteredClientPhones.map(p => `"${p}"`).join(",")})`);
                }
            }

            const { data, count } = await query;
            setClientes(data || []);
            setTotal(count || 0);
        } catch (error) {
            console.error("Error fetching clientes:", error);
        } finally {
            setLoading(false);
        }
    }

    const totalPages = Math.ceil(total / perPage);

    // Build a map of normalized phone -> count for duplicate detection
    const duplicatePhoneMap = (() => {
        const map: Record<string, string[]> = {};
        clientes.forEach(c => {
            if (!c.telefono) return;
            const norm = normalizePhone(c.telefono);
            if (!norm) return;
            if (!map[norm]) map[norm] = [];
            map[norm].push(c.id);
        });
        return map;
    })();

    const isDuplicate = (phone: string) => {
        if (!phone) return false;
        const norm = normalizePhone(phone);
        return norm ? (duplicatePhoneMap[norm]?.length || 0) > 1 : false;
    };

    // Filter to only show duplicates if toggle is on
    const clientesMostrados = showDuplicates
        ? clientes.filter(c => c.telefono && isDuplicate(c.telefono))
        : clientes;

    function buildWhatsAppMessage(nombre: string) {
        return waTemplate.replace(/\{nombre\}/gi, nombre);
    }

    return (
        <section className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Clientes</h2>

            {/* Filters */}
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex gap-3 items-center flex-wrap">
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        <button 
                            onClick={() => { setLoyaltyFilter("todos"); setPage(1); }}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${loyaltyFilter === "todos" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                        >
                            TODOS
                        </button>
                        <button 
                            onClick={() => { setLoyaltyFilter("con_compras"); setPage(1); }}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${loyaltyFilter === "con_compras" ? "bg-emerald-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                        >
                            CON COMPRAS
                        </button>
                        <button 
                            onClick={() => { setLoyaltyFilter("sin_compras"); setPage(1); }}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${loyaltyFilter === "sin_compras" ? "bg-amber-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                        >
                            SIN COMPRAS
                        </button>
                    </div>

                    <fieldset className="border border-gray-300 rounded-lg px-3 py-1.5 bg-white min-w-[200px]">
                        <legend className="text-[10px] text-gray-500 px-1 font-semibold uppercase tracking-wider">Buscar cliente</legend>
                        <div className="flex items-center gap-2">
                            <Search size={14} className="text-gray-400" />
                            <input type="text" value={busqueda} onChange={e => { setBusqueda(e.target.value); setPage(1); }} className="bg-transparent outline-none text-sm text-gray-900 w-full" placeholder="Nombre o teléfono..." />
                        </div>
                    </fieldset>

                    <div className="ml-auto flex gap-2">
                        <button 
                            onClick={() => setShowDuplicates(!showDuplicates)} 
                            className={`flex items-center gap-1.5 text-sm font-bold px-3 py-2 rounded-xl border transition-all ${
                                showDuplicates 
                                    ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-sm' 
                                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-100'
                            }`}
                        >
                            <Users size={14} /> Duplicados
                        </button>
                        <button 
                            onClick={() => setShowTemplateEditor(!showTemplateEditor)} 
                            className={`flex items-center gap-1.5 text-sm font-bold px-3 py-2 rounded-xl border transition-all ${
                                showTemplateEditor 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm' 
                                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-100'
                            }`}
                        >
                            <Edit3 size={14} /> Mensaje WA
                        </button>
                        <button onClick={() => setShowHeatmap(true)} className="flex items-center gap-1 text-purple-600 text-sm font-medium hover:underline px-3 py-2">
                            <MapPin size={14} /> Mapa de calor
                        </button>
                        <button className="flex items-center gap-1 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors">
                            <Download size={14} /> Exportar
                        </button>
                    </div>
                </div>

                {/* WhatsApp Template Editor */}
                {showTemplateEditor && (
                    <div className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-200 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <MessageCircle size={16} className="text-emerald-600" />
                                <span className="text-sm font-bold text-emerald-900">Personalizar mensaje de WhatsApp</span>
                            </div>
                            <button onClick={() => setShowTemplateEditor(false)} className="text-gray-400 hover:text-gray-600 text-xs font-bold">Cerrar ×</button>
                        </div>
                        <div className="flex gap-3 items-start">
                            <div className="flex-1">
                                <textarea
                                    rows={2}
                                    value={waTemplate}
                                    onChange={e => setWaTemplate(e.target.value)}
                                    className="w-full border border-emerald-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-emerald-500 bg-white shadow-sm transition-all resize-none"
                                    placeholder="Escribí tu mensaje..."
                                />
                                <p className="text-[10px] text-emerald-600 mt-1.5 font-medium">
                                    💡 Usá <code className="bg-emerald-100 px-1 py-0.5 rounded font-bold">{'{nombre}'}</code> para insertar el nombre del cliente automáticamente.
                                </p>
                            </div>
                            <div className="bg-white rounded-xl border border-emerald-200 p-3 min-w-[200px] shadow-sm">
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Vista previa</p>
                                <p className="text-xs text-gray-700 leading-relaxed">{waTemplate.replace(/\{nombre\}/gi, 'Juan')}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Duplicates info banner */}
                {showDuplicates && (
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm flex items-center gap-3">
                        <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                        <div className="flex-1">
                            <p className="text-sm font-bold text-amber-900">Filtro de duplicados activo</p>
                            <p className="text-xs text-amber-700 mt-0.5">
                                Mostrando clientes con teléfonos duplicados (normalización inteligente: ignora guiones, +54, 549, 0, 15). 
                                Se encontraron <span className="font-bold">{clientesMostrados.length}</span> registros potencialmente duplicados.
                            </p>
                        </div>
                        <button onClick={() => setShowDuplicates(false)} className="text-amber-600 hover:text-amber-800 text-xs font-bold shrink-0">Desactivar</button>
                    </div>
                )}

                {loyaltyFilter !== "todos" && (
                    <div className="flex gap-4 items-end p-5 bg-[#F8FAFC] rounded-2xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                        <fieldset className="border border-slate-200 rounded-xl px-3 py-1.5 bg-white shadow-sm transition-all focus-within:ring-2 focus-within:ring-purple-500/20 focus-within:border-purple-500">
                            <legend className="text-[10px] text-slate-500 px-1 font-bold uppercase tracking-wider flex items-center gap-1">
                                <Calendar size={10} /> Desde
                            </legend>
                            <input 
                                type="date" 
                                value={fechaDesde} 
                                onChange={e => { setFechaDesde(e.target.value); setPage(1); }}
                                className="bg-transparent outline-none text-sm text-slate-900 w-full" 
                            />
                        </fieldset>
                        <fieldset className="border border-slate-200 rounded-xl px-3 py-1.5 bg-white shadow-sm transition-all focus-within:ring-2 focus-within:ring-purple-500/20 focus-within:border-purple-500">
                            <legend className="text-[10px] text-slate-500 px-1 font-bold uppercase tracking-wider flex items-center gap-1">
                                <Calendar size={10} /> Hasta
                            </legend>
                            <input 
                                type="date" 
                                value={fechaHasta} 
                                onChange={e => { setFechaHasta(e.target.value); setPage(1); }}
                                className="bg-transparent outline-none text-sm text-slate-900 w-full" 
                            />
                        </fieldset>
                        <fieldset className="border border-slate-200 rounded-xl px-3 py-1.5 bg-white shadow-sm transition-all focus-within:ring-2 focus-within:ring-purple-500/20 focus-within:border-purple-500 min-w-[220px] relative group/select">
                            <legend className="text-[10px] text-slate-500 px-1 font-bold uppercase tracking-wider flex items-center gap-1">
                                <Filter size={10} /> Productos ({productoFiltro.length === 0 ? "Todos" : productoFiltro.length})
                            </legend>
                            <div className="relative">
                                <button className="w-full text-left bg-transparent outline-none text-sm text-slate-900 font-semibold flex justify-between items-center py-1">
                                    <span className="truncate max-w-[180px]">
                                        {productoFiltro.length === 0 ? "TODOS LOS PRODUCTOS" : productoFiltro.join(", ")}
                                    </span>
                                    <ChevronRight size={14} className="group-hover/select:rotate-90 transition-transform" />
                                </button>
                                
                                <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 hidden group-hover/select:block max-h-60 overflow-y-auto">
                                    <label className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer text-xs font-bold text-slate-700 border-b border-slate-100 mb-1">
                                        <input 
                                            type="checkbox" 
                                            className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 h-4 w-4"
                                            checked={productoFiltro.length === 0}
                                            onChange={() => setProductoFiltro([])}
                                        />
                                        TODOS LOS PRODUCTOS
                                    </label>
                                    {listaProductos.map(p => (
                                        <label key={p} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer text-xs text-slate-600 font-medium">
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 h-4 w-4"
                                                checked={productoFiltro.includes(p)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setProductoFiltro([...productoFiltro, p]);
                                                    } else {
                                                        setProductoFiltro(productoFiltro.filter(item => item !== p));
                                                    }
                                                    setPage(1);
                                                }}
                                            />
                                            {p}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </fieldset>
                        <div className="flex-1 text-[11px] text-slate-500 mb-2 leading-tight">
                            <span className="font-bold text-slate-700 block mb-0.5">Campaña de Fidelización</span>
                            Mostrando clientes {loyaltyFilter === "con_compras" ? "activos" : "inactivos"} {productoFiltro.length > 0 ? `que compraron ${productoFiltro.length} productos específicos` : "en general"} durante el periodo.
                        </div>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                            <th className="px-4 py-3 text-left font-semibold cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => handleSort("nombre")}>
                                <div className="flex items-center gap-1">Nombre <SortIcon column="nombre" /></div>
                            </th>
                            <th className="px-4 py-3 text-left font-semibold cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => handleSort("telefono")}>
                                <div className="flex items-center gap-1">WhatsApp <SortIcon column="telefono" /></div>
                            </th>
                            <th className="px-4 py-3 text-left font-semibold cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => handleSort("email")}>
                                <div className="flex items-center gap-1">Email <SortIcon column="email" /></div>
                            </th>
                            <th className="px-4 py-3 text-left font-semibold cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => handleSort("direccion")}>
                                <div className="flex items-center gap-1">Dirección <SortIcon column="direccion" /></div>
                            </th>
                            <th className="px-4 py-3 text-center font-semibold cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => handleSort("total_pedidos")}>
                                <div className="flex items-center justify-center gap-1">Pedidos <SortIcon column="total_pedidos" /></div>
                            </th>
                            <th className="px-4 py-3 text-left font-semibold">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} className="text-center py-10 text-gray-400">Cargando clientes...</td></tr>
                        ) : clientes.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-10 text-gray-400">No se encontraron clientes con estos filtros.</td></tr>
                        ) : clientesMostrados.map(c => (
                            <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 group">
                                <td className="px-4 py-3">
                                    <div className="text-gray-900 font-bold">{c.nombre}</div>
                                    <div className="text-[10px] text-gray-400">ID: {c.id.slice(0, 8)}</div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-gray-900 font-medium">{c.telefono || "—"}</span>
                                            {showDuplicates && isDuplicate(c.telefono) && (
                                                <span className="bg-amber-100 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-amber-200">DUPLICADO</span>
                                            )}
                                        </div>
                                        {showDuplicates && c.telefono && (
                                            <span className="text-[10px] text-gray-400 font-mono">→ {normalizePhone(c.telefono)}</span>
                                        )}
                                        {c.telefono && (
                                            <a 
                                                href={`https://wa.me/${c.telefono.replace(/\D/g, '')}`} 
                                                target="_blank" 
                                                className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-bold text-xs mt-0.5"
                                            >
                                                <MessageCircle size={12} /> WhatsApp
                                            </a>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-gray-600">{c.email || "—"}</td>
                                <td className="px-4 py-3">
                                    <a href={`https://maps.google.com/?q=${encodeURIComponent(c.direccion || "")}`} target="_blank" className="text-purple-600 hover:underline flex items-center gap-1">
                                        <MapPin size={12} /> {c.direccion || "—"}
                                    </a>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <div className="bg-gray-100 rounded-lg py-1 px-2 inline-block">
                                        <div className="font-bold text-gray-900 text-xs">{c.total_pedidos}</div>
                                        <div className="text-[9px] text-gray-500 uppercase font-semibold">Pedidos</div>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setSelectedCliente(c)} className="bg-purple-50 text-purple-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-purple-100 transition-colors border border-purple-200">
                                            Ver detalle
                                        </button>
                                        {c.telefono && (
                                            <a 
                                                href={`https://wa.me/${c.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(buildWhatsAppMessage(c.nombre))}`} 
                                                target="_blank" 
                                                className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors border border-emerald-200 flex items-center gap-1"
                                            >
                                                Contactar
                                            </a>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
                    <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }} className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white">
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                    </select>
                    <span>{(page - 1) * perPage + 1} – {Math.min(page * perPage, total)} de {total}</span>
                    <div className="flex gap-1">
                        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronLeft size={16} /></button>
                        <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronRight size={16} /></button>
                    </div>
                </div>
            </div>

            {selectedCliente && sucursalId && (
                <ClienteDetailModal
                    cliente={selectedCliente}
                    sucursalId={sucursalId}
                    onClose={() => setSelectedCliente(null)}
                />
            )}

            {showHeatmap && sucursalId && (
                <HeatmapModal
                    sucursalId={sucursalId}
                    onClose={() => setShowHeatmap(false)}
                />
            )}
        </section>
    );
}
