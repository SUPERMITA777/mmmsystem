"use client";

import { ChevronDown, Headphones } from "lucide-react";

export function AdminTopBar() {
  return (
    <header className="h-14 flex items-center justify-between px-6 bg-white border-b border-gray-200">
      {/* Left: collapse icon */}
      <div className="flex items-center gap-2">
        <button className="text-gray-400 hover:text-gray-600 transition-colors text-xl">≡</button>
      </div>

      {/* Right: buttons */}
      <div className="flex items-center gap-3">
        <button className="rounded-full bg-gray-900 px-5 py-1.5 text-xs font-semibold text-white hover:bg-gray-800 transition-colors">
          Ver tienda
        </button>
        <button className="rounded-full border border-gray-300 px-4 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1.5">
          <Headphones size={13} />
          Soporte
        </button>
        <button className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
          MMM Pizza
          <ChevronDown size={14} />
        </button>
        <button className="text-gray-400 hover:text-gray-600 transition-colors text-lg">⋮</button>
      </div>
    </header>
  );
}
