"use client";

import { ChevronDown, Headphones, Volume2, VolumeX, Menu } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useTenant } from "@/context/TenantContext";
import { useNotifications } from "@/context/NotificationContext";
import { useAdminUI } from "@/context/AdminUIContext";

export function AdminTopBar() {
  const params = useParams();
  const pathname = usePathname();
  const tenantSlug = params?.tenant || pathname.split('/')[1] || "demo";
  const { sucursalData } = useTenant();
  const { audioEnabled, enableAudio, isAudioContextSuspended } = useNotifications();
  const { toggleMobileSidebar } = useAdminUI();

  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-6 bg-white border-b border-gray-200 sticky top-0 z-50">
      {/* Left: collapse icon */}
      <div className="flex items-center gap-4">
        <button 
          onClick={toggleMobileSidebar}
          className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Menu size={24} />
        </button>
        <div className="hidden md:block">
          <h2 className="text-sm font-medium text-gray-400">Admin Mode</h2>
        </div>
      </div>

      {/* Right: buttons */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Audio Notification Status */}
        <button
          onClick={enableAudio}
          className={`flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all shadow-sm ${
            audioEnabled 
              ? isAudioContextSuspended 
                ? "bg-orange-100 text-orange-600 border border-orange-200 animate-pulse" 
                : "bg-green-100 text-green-600 border border-green-200"
              : "bg-gray-100 text-gray-400 border border-gray-200 hover:bg-gray-200"
          }`}
          title={audioEnabled ? (isAudioContextSuspended ? "Click para activar sonido" : "Sonido activo") : "Activar sonido de notificaciones"}
        >
          {audioEnabled ? (
            isAudioContextSuspended ? <VolumeX size={12} /> : <Volume2 size={12} />
          ) : (
            <VolumeX size={12} />
          )}
          <span className="hidden sm:inline">{audioEnabled ? (isAudioContextSuspended ? "Desbloquear" : "Activo") : "Sin Sonido"}</span>
        </button>

        <Link
          href={`/${tenantSlug}`}
          target="_blank"
          className="rounded-full bg-[#7B1FA2] px-3 md:px-5 py-1.5 text-[10px] md:text-xs font-semibold text-white hover:opacity-90 transition-all shadow-sm whitespace-nowrap"
        >
          Ver tienda
        </Link>
        <button className="hidden sm:flex rounded-full border border-gray-200 px-4 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-all items-center gap-1.5 shadow-sm">
          <Headphones size={13} className="text-[#7B1FA2]" />
          Soporte
        </button>
        <div className="hidden sm:block h-6 w-[1px] bg-gray-200 mx-1"></div>
        <button className="flex items-center gap-2 text-sm font-semibold text-gray-800 hover:text-gray-900 transition-colors cursor-pointer group">
          <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-[#7B1FA2] text-xs font-bold border border-purple-100 group-hover:bg-purple-100 transition-colors">
            {sucursalData?.nombre ? sucursalData.nombre.charAt(0).toUpperCase() : 'M'}
          </div>
          <span className="max-w-[100px] md:max-w-[150px] truncate hidden sm:inline">{sucursalData?.nombre || "MMM PIZZA"}</span>
          <ChevronDown size={14} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
        </button>
      </div>
    </header>
  );
}
