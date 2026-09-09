"use client";

import { CheckCircle2, Sparkles, Key, Lightbulb, Smartphone, ShieldCheck, Zap } from "lucide-react";

export default function MarketingConfigTab() {
    return (
        <div className="space-y-6 max-w-4xl">
            {/* Estado del Motor de IA */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                    <div className="w-10 h-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center">
                        <CheckCircle2 size={22} />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-gray-900">Motor de Inteligencia Artificial Conectado</h3>
                        <p className="text-xs text-gray-500">
                            Estado de los servicios de generación de imágenes y copy
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Tarjeta Gemini */}
                    <div className="p-4 rounded-xl border-2 border-purple-200 bg-purple-50/50 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-[#7B1FA2] flex items-center gap-1.5">
                                <Sparkles size={16} /> Google Gemini AI
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-700 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Activo
                            </span>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">
                            Utiliza los modelos de última generación <code className="text-purple-900 font-mono text-[11px] bg-purple-100 px-1 py-0.5 rounded">gemini-2.5-flash-image</code> para arte visual publicitario y <code className="text-purple-900 font-mono text-[11px] bg-purple-100 px-1 py-0.5 rounded">gemini-2.5-flash</code> para redacción de copys gastronómicos persuasivos.
                        </p>
                        <div className="pt-2 border-t border-purple-100 text-[11px] text-purple-900 font-medium flex items-center gap-1.5">
                            <ShieldCheck size={14} className="text-purple-700" />
                            Configurado en tu archivo .env (GEMINI_API_KEY)
                        </div>
                    </div>

                    {/* Tarjeta OpenAI Opcional */}
                    <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/70 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
                                <Key size={16} className="text-gray-500" /> OpenAI DALL-E (Opcional)
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-200 text-gray-600">
                                Standby
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            Si en el futuro deseas usar modelos alternativos como DALL-E 3, simplemente puedes agregar <code className="text-gray-700 font-mono text-[11px] bg-gray-200 px-1 py-0.5 rounded">OPENAI_API_KEY</code> en tu archivo <code className="font-mono text-[11px]">.env</code>.
                        </p>
                        <div className="pt-2 border-t border-gray-200 text-[11px] text-gray-400">
                            Actualmente no es requerido ya que Gemini cubre la generación completa.
                        </div>
                    </div>
                </div>
            </div>

            {/* Consejos para crear los mejores flyers */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-2 text-amber-600">
                    <Lightbulb size={20} />
                    <h3 className="font-bold text-gray-900 text-base">Consejos para Flyers Gastronómicos de Alto Impacto</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-gray-600">
                    <div className="p-3.5 bg-amber-50/50 border border-amber-200/60 rounded-xl space-y-1.5">
                        <strong className="text-gray-900 font-bold block flex items-center gap-1">
                            <Zap size={14} className="text-amber-600" /> 1. Destacá los Ingredientes Clave
                        </strong>
                        <p className="leading-relaxed text-gray-600">
                            Cuanto más específicos sean los ingredientes (ej: "queso derretido", "panceta ahumada crujiente"), más apetitosa y realista resultará la imagen generada.
                        </p>
                    </div>

                    <div className="p-3.5 bg-purple-50/50 border border-purple-200/60 rounded-xl space-y-1.5">
                        <strong className="text-gray-900 font-bold block flex items-center gap-1">
                            <Smartphone size={14} className="text-purple-600" /> 2. Formato según la Red Social
                        </strong>
                        <p className="leading-relaxed text-gray-600">
                            Usá <strong>Historia / Estado (9:16)</strong> para WhatsApp y Stories de Instagram. Para el Feed principal seleccioná <strong>Post Cuadrado (1:1)</strong> o Retrato (4:5).
                        </p>
                    </div>

                    <div className="p-3.5 bg-blue-50/50 border border-blue-200/60 rounded-xl space-y-1.5">
                        <strong className="text-gray-900 font-bold block flex items-center gap-1">
                            <Sparkles size={14} className="text-blue-600" /> 3. Copys con Llamado Claro
                        </strong>
                        <p className="leading-relaxed text-gray-600">
                            La IA redacta un copy con gancho, emojis y hashtags listos. Siempre recordale al cliente cómo hacer el pedido (ej: link en bio o WhatsApp).
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
