"use client";

import { ChevronDown } from "lucide-react";

export function AdminTopBar() {
  return (
    <header className="h-14 flex items-center justify-between px-6 bg-[#1a1a2e]">
      <div className="flex items-center gap-2">
        <span className="text-gray-500 text-lg">≡</span>
      </div>

      <div className="flex items-center gap-3">
        <button className="rounded-full border border-gray-500 px-4 py-1.5 text-xs font-semibold text-gray-200 hover:bg-white/10 transition-colors">
          Ver tienda
        </button>
        <button className="rounded-full border border-purple-500 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-500/20 transition-colors">
          Soporte
        </button>
        <button className="flex items-center gap-1 text-xs font-medium text-gray-300 hover:text-white transition-colors">
          MMM Pizza
          <ChevronDown size={14} />
        </button>
      </div>
    </header>
  );
}
