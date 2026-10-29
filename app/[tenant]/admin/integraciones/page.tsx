"use client";

import { Plug, MessageCircle, ShoppingBag, CreditCard, Copy, Check } from "lucide-react";
import { useTenant } from "@/context/TenantContext";
import { useState } from "react";

const INTEGRACIONES = [
    { nombre: "WhatsApp Business", icon: MessageCircle, desc: "Envía confirmaciones y actualizaciones por WhatsApp", color: "bg-green-50 text-green-600", conectado: true },
    { nombre: "PedidosYa", icon: ShoppingBag, desc: "Recibe pedidos de PedidosYa directamente en este local", color: "bg-red-50 text-red-600", conectado: false, installLink: "/downloads/pedidosya-linker.zip", isPedidosYa: true },
    { nombre: "Rappi", icon: ShoppingBag, desc: "Recibe pedidos de Rappi directamente", color: "bg-orange-50 text-orange-600", conectado: false },
    { nombre: "MercadoPago", icon: CreditCard, desc: "Acepta pagos online con MercadoPago", color: "bg-blue-50 text-blue-600", conectado: false },
];

export default function IntegracionesPage() {
    const { sucursalId } = useTenant();
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (!sucursalId) return;
        navigator.clipboard.writeText(sucursalId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <section className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Integraciones</h2>
            <p className="text-sm text-gray-500 mb-6">Conecta tu local con servicios externos</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {INTEGRACIONES.map(integ => (
                    <div key={integ.nombre} className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col justify-between">
                        <div className="flex items-start gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${integ.color}`}>
                                <integ.icon size={22} />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900 text-sm">{integ.nombre}</h3>
                                <p className="text-xs text-gray-500 mt-0.5">{integ.desc}</p>
                                
                                {integ.isPedidosYa && sucursalId && (
                                    <div className="mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Código de este local</span>
                                            <span className="font-mono text-xs font-bold text-slate-700">{sucursalId}</span>
                                        </div>
                                        <button 
                                            onClick={handleCopy}
                                            className="p-1.5 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                                            title="Copiar código"
                                        >
                                            {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                                            <span className="text-[10px]">{copied ? "Copiado" : "Copiar"}</span>
                                        </button>
                                    </div>
                                )}

                                {integ.installLink && (
                                    <a
                                        href={integ.installLink}
                                        className="inline-block mt-3 text-xs font-bold text-red-600 hover:underline flex items-center gap-1"
                                        download
                                    >
                                        📥 Descargar Extensión Chrome
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
