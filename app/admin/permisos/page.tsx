"use client";

import { useState } from "react";
import { Save } from "lucide-react";

const ROLES = ["super_admin", "admin", "cajero", "cocinero", "repartidor"];
const MODULOS = ["Pedidos", "Menú", "Cajas", "Stock", "Clientes", "Reportes", "Usuarios", "Configuraciones"];

type PermisoMatrix = Record<string, Record<string, boolean>>;

export default function PermisosPage() {
    const [permisos, setPermisos] = useState<PermisoMatrix>(() => {
        const initial: PermisoMatrix = {};
        ROLES.forEach(r => {
            initial[r] = {};
            MODULOS.forEach(m => {
                initial[r][m] = r === "super_admin" || r === "admin";
            });
        });
        // Defaults for other roles
        initial.cajero = { Pedidos: true, Menú: false, Cajas: true, Stock: false, Clientes: false, Reportes: false, Usuarios: false, Configuraciones: false };
        initial.cocinero = { Pedidos: true, Menú: false, Cajas: false, Stock: true, Clientes: false, Reportes: false, Usuarios: false, Configuraciones: false };
        initial.repartidor = { Pedidos: true, Menú: false, Cajas: false, Stock: false, Clientes: false, Reportes: false, Usuarios: false, Configuraciones: false };
        return initial;
    });

    function togglePermiso(rol: string, modulo: string) {
        if (rol === "super_admin") return; // Can't modify super_admin
        setPermisos(prev => ({
            ...prev,
            [rol]: { ...prev[rol], [modulo]: !prev[rol][modulo] },
        }));
    }

    const ROL_LABEL: Record<string, string> = {
        super_admin: "Super Admin",
        admin: "Admin",
        cajero: "Cajero",
        cocinero: "Cocinero",
        repartidor: "Repartidor",
    };

    return (
        <section className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Permisos</h2>
                    <p className="text-sm text-gray-500 mt-1">Configura los permisos de acceso por rol</p>
                </div>
                <button className="flex items-center gap-1 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors">
                    <Save size={14} /> Guardar cambios
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100">
                            <th className="px-4 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-semibold">Rol</th>
                            {MODULOS.map(m => (
                                <th key={m} className="px-3 py-3 text-center text-gray-500 text-xs uppercase tracking-wider font-semibold">{m}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {ROLES.map(rol => (
                            <tr key={rol} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="px-4 py-3 font-bold text-gray-900">{ROL_LABEL[rol]}</td>
                                {MODULOS.map(modulo => (
                                    <td key={modulo} className="px-3 py-3 text-center">
                                        <button
                                            onClick={() => togglePermiso(rol, modulo)}
                                            disabled={rol === "super_admin"}
                                            className={`w-9 h-5 rounded-full relative transition-colors ${permisos[rol][modulo] ? "bg-green-500" : "bg-gray-300"
                                                } ${rol === "super_admin" ? "opacity-60 cursor-not-allowed" : ""}`}
                                        >
                                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${permisos[rol][modulo] ? "left-4" : "left-0.5"
                                                }`} />
                                        </button>
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
