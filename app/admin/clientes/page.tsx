"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Search, Download, MapPin, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

type Cliente = {
    id: string;
    nombre: string;
    telefono: string;
    email: string;
    direccion: string;
    total_pedidos: number;
    total_gastado: number;
};

export default function ClientesPage() {
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState("");
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [total, setTotal] = useState(0);

    useEffect(() => { fetchClientes(); }, [page, perPage, busqueda]);

    async function fetchClientes() {
        setLoading(true);
        let query = supabase
            .from("clientes")
            .select("*", { count: "exact" })
            .order("total_pedidos", { ascending: false })
            .range((page - 1) * perPage, page * perPage - 1);

        if (busqueda) {
            query = query.ilike("nombre", `%${busqueda}%`);
        }

        const { data, count } = await query;
        setClientes(data || []);
        setTotal(count || 0);
        setLoading(false);
    }

    const totalPages = Math.ceil(total / perPage);

    return (
        <section className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Clientes</h2>

            {/* Filters */}
            <div className="flex gap-3 mb-4 items-center">
                <fieldset className="border border-gray-300 rounded-lg px-3 py-1.5 bg-white flex-1 max-w-xs">
                    <legend className="text-[10px] text-gray-500 px-1">Buscar cliente</legend>
                    <div className="flex items-center gap-2">
                        <Search size={14} className="text-gray-400" />
                        <input type="text" value={busqueda} onChange={e => { setBusqueda(e.target.value); setPage(1); }} className="bg-transparent outline-none text-sm text-gray-900 w-full" placeholder="" />
                    </div>
                </fieldset>
                <fieldset className="border border-gray-300 rounded-lg px-3 py-1.5 bg-white">
                    <legend className="text-[10px] text-gray-500 px-1">Fecha de pedido</legend>
                    <input type="text" readOnly value={`1/1/2026 – ${new Date().toLocaleDateString("es-AR")}`} className="bg-transparent outline-none text-sm text-gray-900 w-40" />
                </fieldset>
                <div className="ml-auto flex gap-2">
                    <button className="flex items-center gap-1 text-purple-600 text-sm font-medium hover:underline">
                        <MapPin size={14} /> Mapa de calor
                    </button>
                    <button className="flex items-center gap-1 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors">
                        <Download size={14} /> Exportar
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                            <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                            <th className="px-4 py-3 text-left font-semibold">WhatsApp</th>
                            <th className="px-4 py-3 text-left font-semibold">Email</th>
                            <th className="px-4 py-3 text-left font-semibold">Dirección</th>
                            <th className="px-4 py-3 text-center font-semibold">Pedidos</th>
                            <th className="px-4 py-3 text-left font-semibold">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} className="text-center py-10 text-gray-400">Cargando...</td></tr>
                        ) : clientes.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-10 text-gray-400">No hay clientes</td></tr>
                        ) : clientes.map(c => (
                            <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="px-4 py-3 text-gray-900 font-medium">{c.nombre}</td>
                                <td className="px-4 py-3">
                                    <a href={`https://wa.me/${c.telefono}`} target="_blank" className="text-purple-600 hover:underline">{c.telefono || "—"}</a>
                                </td>
                                <td className="px-4 py-3 text-gray-600">{c.email || "—"}</td>
                                <td className="px-4 py-3">
                                    <a href={`https://maps.google.com/?q=${encodeURIComponent(c.direccion || "")}`} target="_blank" className="text-purple-600 hover:underline">{c.direccion || "—"}</a>
                                </td>
                                <td className="px-4 py-3 text-center font-bold text-gray-900">{c.total_pedidos}</td>
                                <td className="px-4 py-3">
                                    <button className="text-purple-600 text-xs font-medium hover:underline">Más info</button>
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
        </section>
    );
}
