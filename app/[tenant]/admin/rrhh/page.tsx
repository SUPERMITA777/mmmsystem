"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Edit2, X, User, Briefcase, Clock, DollarSign, Info, Users, TrendingUp } from "lucide-react";
import { useTenant } from "@/context/TenantContext";

type Employee = {
    id: string;
    nombre: string;
    email: string;
    rol: string;
    activo: boolean;
    color?: string;
    sueldo?: number;
    horario?: string;
    informacion_general?: string;
};

const ROL_BADGE: Record<string, string> = {
    super_admin: "bg-red-100 text-red-700 border-red-200",
    admin: "bg-purple-100 text-purple-700 border-purple-200",
    cajero: "bg-blue-100 text-blue-700 border-blue-200",
    cocinero: "bg-orange-100 text-orange-700 border-orange-200",
    repartidor: "bg-green-100 text-green-700 border-green-200",
    camarero: "bg-yellow-100 text-yellow-700 border-yellow-200",
    empleado: "bg-gray-100 text-gray-700 border-gray-200",
};

const ROL_LABELS: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Administrador",
    cajero: "Cajero",
    cocinero: "Cocinero",
    repartidor: "Repartidor",
    camarero: "Camarero",
    empleado: "Empleado",
};

export default function RrhhPage() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [form, setForm] = useState({
        sueldo: "",
        horario: "",
        informacion_general: ""
    });
    const [submitting, setSubmitting] = useState(false);
    const { sucursalId } = useTenant();

    useEffect(() => {
        if (sucursalId) {
            fetchEmployees();
        }
    }, [sucursalId]);

    async function fetchEmployees() {
        if (!sucursalId) return;
        try {
            setLoading(true);
            const res = await fetch(`/api/staff?sucursal_id=${sucursalId}&all=true`);
            if (res.ok) {
                const data = await res.json();
                setEmployees(data || []);
            } else {
                console.error("Error fetching staff:", await res.text());
            }
        } catch (error) {
            console.error("Error fetching staff:", error);
        } finally {
            setLoading(false);
        }
    }

    const openEditModal = (emp: Employee) => {
        setEditingEmployee(emp);
        setForm({
            sueldo: emp.sueldo !== undefined && emp.sueldo !== null ? String(emp.sueldo) : "",
            horario: emp.horario || "",
            informacion_general: emp.informacion_general || ""
        });
    };

    async function handleSave() {
        if (!editingEmployee) return;
        setSubmitting(true);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingEmployee.id,
                    sueldo: form.sueldo === "" ? 0 : Number(form.sueldo),
                    horario: form.horario || null,
                    informacion_general: form.informacion_general || null
                })
            });

            const resData = await res.json();
            if (resData.error) throw new Error(resData.error);

            setEditingEmployee(null);
            fetchEmployees();
        } catch (err: any) {
            alert(err.message || "Error al actualizar información de RRHH");
        } finally {
            setSubmitting(false);
        }
    }

    // Calculations
    const activeStaff = employees.filter(e => e.activo).length;
    const monthlyBudget = employees
        .filter(e => e.activo)
        .reduce((sum, e) => sum + Number(e.sueldo || 0), 0);
    const staffedSchedules = employees
        .filter(e => e.activo && e.horario)
        .length;

    const formatARS = (n: number) => {
        return "$ " + new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0 }).format(n);
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="w-10 h-10 border-4 border-purple-100 border-t-purple-600 rounded-full animate-spin" />
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Cargando RRHH...</p>
        </div>
    );

    return (
        <section className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-2 uppercase italic">GESTIÓN DE RRHH</h1>
                    <p className="text-gray-500 font-bold text-sm tracking-wide">
                        Control de sueldos, horarios de trabajo e información interna del personal.
                    </p>
                </div>
            </div>

            {/* HR Dashboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-white rounded-[2.5rem] p-6 border border-gray-100 shadow-sm flex items-center gap-5">
                    <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-3xl flex items-center justify-center shrink-0">
                        <Users size={28} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1.5">Personal Activo</p>
                        <h3 className="text-3xl font-black text-gray-900 leading-none">{activeStaff} Empleados</h3>
                    </div>
                </div>

                <div className="bg-white rounded-[2.5rem] p-6 border border-gray-100 shadow-sm flex items-center gap-5">
                    <div className="w-14 h-14 bg-green-50 text-green-600 rounded-3xl flex items-center justify-center shrink-0">
                        <TrendingUp size={28} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1.5">Presupuesto Mensual</p>
                        <h3 className="text-3xl font-black text-green-600 leading-none">{formatARS(monthlyBudget)}</h3>
                    </div>
                </div>

                <div className="bg-white rounded-[2.5rem] p-6 border border-gray-100 shadow-sm flex items-center gap-5">
                    <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center shrink-0">
                        <Clock size={28} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1.5">Horarios Asignados</p>
                        <h3 className="text-3xl font-black text-gray-900 leading-none">{staffedSchedules} / {activeStaff}</h3>
                    </div>
                </div>
            </div>

            {/* Employees Table */}
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Colaborador</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Rango</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Sueldo Mensual</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Horario</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Información Interna</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {employees.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-16 text-center text-gray-400 font-bold italic">
                                        No hay personal registrado en la sucursal.
                                    </td>
                                </tr>
                            ) : (
                                employees.map((emp) => (
                                    <tr key={emp.id} className="hover:bg-gray-50/30 transition-colors group">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div 
                                                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black border-2 border-white shadow-sm uppercase shrink-0"
                                                    style={{ backgroundColor: emp.color || "#111" }}
                                                >
                                                    {emp.nombre.charAt(0)}
                                                </div>
                                                <div className="overflow-hidden">
                                                    <p className="font-black text-gray-900 tracking-tight truncate">{emp.nombre}</p>
                                                    <p className="text-[11px] text-gray-400 font-bold truncate">{emp.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border shadow-sm ${ROL_BADGE[emp.rol] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                                                {ROL_LABELS[emp.rol] || emp.rol}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 font-bold text-gray-900">
                                            {emp.sueldo ? formatARS(emp.sueldo) : <span className="text-gray-300 font-normal italic">Sin asignar</span>}
                                        </td>
                                        <td className="px-8 py-5 font-bold text-gray-700">
                                            {emp.horario ? (
                                                <span className="flex items-center gap-1.5">
                                                    <Clock size={14} className="text-gray-400" />
                                                    {emp.horario}
                                                </span>
                                            ) : (
                                                <span className="text-gray-300 font-normal italic">Sin asignar</span>
                                            )}
                                        </td>
                                        <td className="px-8 py-5 text-gray-500 max-w-[280px]">
                                            <p className="truncate text-xs font-medium" title={emp.informacion_general || ""}>
                                                {emp.informacion_general || <span className="text-gray-300 italic font-normal">Sin información</span>}
                                            </p>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            {emp.rol !== "super_admin" && (
                                                <button
                                                    onClick={() => openEditModal(emp)}
                                                    className="p-3 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-2xl transition-all active:scale-90"
                                                    title="Editar RRHH"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit HR Modal */}
            {editingEmployee && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
                    <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-8 pt-8 pb-4 flex items-center justify-between">
                            <h3 className="text-xl font-black text-gray-900 uppercase">Ficha RRHH</h3>
                            <button onClick={() => setEditingEmployee(null)} className="p-2 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all">
                                <X size={20} className="text-gray-400" />
                            </button>
                        </div>

                        <div className="p-8 space-y-5">
                            {/* Employee Info Header */}
                            <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                <div 
                                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black uppercase text-sm"
                                    style={{ backgroundColor: editingEmployee.color || "#111" }}
                                >
                                    {editingEmployee.nombre.charAt(0)}
                                </div>
                                <div className="overflow-hidden">
                                    <h4 className="font-black text-sm text-gray-900 truncate">{editingEmployee.nombre}</h4>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">{ROL_LABELS[editingEmployee.rol] || editingEmployee.rol}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Sueldo Mensual ($)</label>
                                    <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 focus-within:border-black transition-all shadow-sm">
                                        <DollarSign size={16} className="text-gray-400" />
                                        <input
                                            type="number"
                                            value={form.sueldo}
                                            onChange={e => setForm({ ...form, sueldo: e.target.value })}
                                            className="bg-transparent outline-none text-sm font-bold text-gray-900 w-full"
                                            placeholder="Ej: 250000"
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Horario Laboral</label>
                                    <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 focus-within:border-black transition-all shadow-sm">
                                        <Clock size={16} className="text-gray-400" />
                                        <input
                                            type="text"
                                            value={form.horario}
                                            onChange={e => setForm({ ...form, horario: e.target.value })}
                                            className="bg-transparent outline-none text-sm font-bold text-gray-900 w-full"
                                            placeholder="Ej: Lun a Vie 09:00 - 18:00"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Información General</label>
                                    <div className="flex items-start gap-3 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 focus-within:border-black transition-all shadow-sm">
                                        <Info size={16} className="text-gray-400 mt-0.5 shrink-0" />
                                        <textarea
                                            value={form.informacion_general}
                                            onChange={e => setForm({ ...form, informacion_general: e.target.value })}
                                            className="bg-transparent outline-none text-xs font-bold text-gray-900 w-full min-h-[90px] resize-none"
                                            placeholder="Detalles sobre contrato, obra social, información de contacto de emergencia, etc..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    onClick={() => setEditingEmployee(null)}
                                    className="flex-1 px-6 py-4 rounded-2xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-all active:scale-95"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={submitting}
                                    className="flex-1 bg-purple-600 text-white px-6 py-4 rounded-2xl text-sm font-black hover:bg-purple-700 transition-all shadow-xl shadow-purple-100 active:scale-95 disabled:opacity-50 disabled:scale-100"
                                >
                                    {submitting ? "Guardando..." : "Guardar"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
