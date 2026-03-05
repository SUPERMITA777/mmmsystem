"use client";

import { FileText, Settings } from "lucide-react";

export default function FacturacionArcaPage() {
    return (
        <section className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Facturación ARCA</h2>
            <p className="text-sm text-gray-500 mb-6">Integración con AFIP para emisión de comprobantes electrónicos</p>

            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-lg mx-auto">
                <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="font-bold text-gray-900 mb-2">Configurar facturación electrónica</h3>
                <p className="text-sm text-gray-500 mb-4">Para emitir facturas electrónicas, necesitás configurar tus datos de ARCA (AFIP).</p>
                <button className="flex items-center gap-2 mx-auto bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors">
                    <Settings size={14} /> Configurar ARCA
                </button>
            </div>
        </section>
    );
}
