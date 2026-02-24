"use client";

import { ChevronDown, Headphones } from "lucide-react";
import Link from "next/link";

export function AdminTopBar() {
  return (
    <header className="h-14 flex items-center justify-between px-6 bg-white border-b border-gray-200">
      {/* Left: collapse icon */}
      <div className="flex items-center gap-2">
        <button className="text-gray-400 hover:text-gray-600 transition-colors text-xl">≡</button>
      </div>

      {/* Right: buttons */}
      <div className="flex items-center gap-3">
        <Link
          href="/"
          target="_blank"
          className="rounded-full bg-[#7B1FA2] px-5 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-all shadow-sm"
        >
          Ver tienda
        </Link>
        <button className="rounded-full border border-gray-200 px-4 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-1.5 shadow-sm">
          <Headphones size={13} className="text-[#7B1FA2]" />
          Soporte
        </button>
        <div className="h-6 w-[1px] bg-gray-200 mx-1"></div>
        <button className="flex items-center gap-2 text-sm font-semibold text-gray-800 hover:text-gray-900 transition-colors">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 text-xs font-bold border border-gray-200">
            M
          </div>
          MMM Pizza
          <ChevronDown size={14} className="text-gray-400" />
        </button>
        <button className="text-gray-400 hover:text-gray-600 transition-colors text-lg">⋮</button>
      </div>
    </header>
  );
}
