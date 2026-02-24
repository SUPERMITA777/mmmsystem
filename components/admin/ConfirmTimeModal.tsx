"use client";

import { X, Clock } from "lucide-react";
import { useState } from "react";

interface ConfirmTimeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (minutes: number) => void;
    orderNumber: string;
}

const PRESET_TIMES = [15, 30, 45, 60, 90];

export default function ConfirmTimeModal({ isOpen, onClose, onConfirm, orderNumber }: ConfirmTimeModalProps) {
    const [customTime, setCustomTime] = useState("");

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100 flex flex-col">
                <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-black text-gray-900">Confirmar Pedido</h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{orderNumber}</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-gray-50 text-gray-400 hover:text-gray-600 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="flex items-center gap-3 text-[#7B1FA2]">
                        <Clock size={24} />
                        <span className="text-sm font-black text-gray-900">¿Cuánto tiempo de demora?</span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        {PRESET_TIMES.map(time => (
                            <button
                                key={time}
                                onClick={() => onConfirm(time)}
                                className="bg-gray-50 border border-gray-200 hover:border-[#7B1FA2] hover:bg-purple-50 hover:text-[#7B1FA2] py-4 rounded-2xl text-sm font-black transition-all active:scale-95"
                            >
                                {time}'
                            </button>
                        ))}
                        <div className="relative col-span-1">
                            <input
                                type="number"
                                placeholder="Otro"
                                value={customTime}
                                onChange={e => setCustomTime(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 py-4 rounded-2xl text-sm font-black text-center outline-none focus:border-[#7B1FA2] focus:ring-1 focus:ring-[#7B1FA2]"
                            />
                        </div>
                    </div>

                    <button
                        onClick={() => customTime && onConfirm(parseInt(customTime))}
                        disabled={!customTime}
                        className="w-full bg-[#7B1FA2] text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-200 transition-all hover:opacity-90 disabled:opacity-30"
                    >
                        Confirmar Demora
                    </button>
                </div>
            </div>
        </div>
    );
}
