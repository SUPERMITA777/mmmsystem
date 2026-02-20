"use client";

import { Plug, MessageCircle, ShoppingBag, CreditCard } from "lucide-react";

const INTEGRACIONES = [
    { nombre: "WhatsApp Business", icon: MessageCircle, desc: "Envía confirmaciones y actualizaciones por WhatsApp", color: "bg-green-50 text-green-600", conectado: true },
    { nombre: "PedidosYa", icon: ShoppingBag, desc: "Recibe pedidos de PedidosYa directamente", color: "bg-red-50 text-red-600", conectado: false, installLink: "/downloads/pedidosya-linker.zip" },
    { nombre: "Rappi", icon: ShoppingBag, desc: "Recibe pedidos de Rappi directamente", color: "bg-orange-50 text-orange-600", conectado: false },
    { nombre: "MercadoPago", icon: CreditCard, desc: "Acepta pagos online con MercadoPago", color: "bg-blue-50 text-blue-600", conectado: false },
];

export default function IntegracionesPage() {
    return (
        <section className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Integraciones</h2>
            <p className="text-sm text-gray-500 mb-6">Conecta tu local con servicios externos</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {INTEGRACIONES.map(integ => (
                    <div key={integ.nombre} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${integ.color}`}>
                            <integ.icon size={22} />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-gray-900 text-sm">{integ.nombre}</h3>
                            <p className="text-xs text-gray-500 mt-0.5">{integ.desc}</p>
                            {integ.installLink && (
                                <a
                                    href={integ.installLink}
                                    className="inline-block mt-2 text-[10px] font-bold text-red-600 hover:underline flex items-center gap-1"
                                    download
                                >
                                    📥 Descargar Extensión
                                </a>
                            )}
                        </div>
                        <button className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${integ.conectado
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                            }`}>
                            {integ.conectado ? "Conectado" : "Conectar"}
                        </button>
                    </div>
                ))}
            </div>
        </section>
    );
}
