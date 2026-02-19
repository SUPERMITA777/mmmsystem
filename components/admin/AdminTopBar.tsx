"use client";

import { ChevronDown } from "lucide-react";

export function AdminTopBar() {
  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-slate-200 bg-white">
      <div className="text-sm font-semibold text-slate-700">
        MMM Pizza
      </div>

      <div className="flex items-center gap-3">
        <button className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold">
          Ver tienda
        </button>
        <button className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
          Soporte
        </button>
        <button className="flex items-center gap-1 text-xs font-medium text-slate-700">
          MMM Pizza
          <ChevronDown size={14} />
        </button>
      </div>
    </header>
  );
}

