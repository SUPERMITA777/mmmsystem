"use client";

import { ChevronDown, Headphones, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useTenant } from "@/context/TenantContext";
import { useNotifications } from "@/context/NotificationContext";

export function AdminTopBar() {
  const params = useParams();
  const pathname = usePathname();
  const tenantSlug = params?.tenant || pathname.split('/')[1] || "demo";
  const { sucursalData } = useTenant();
  const { audioEnabled, enableAudio, isAudioContextSuspended } = useNotifications();

  return (
    <header className="h-14 flex items-center justify-between px-6 bg-white border-b border-gray-200">
      {/* Left: collapse icon */}
      <div className="flex items-center gap-2">
        <button className="text-gray-400 hover:text-gray-600 transition-colors text-xl">≡</button>
      </div>

      {/* Right: buttons */}
      <div className="flex items-center gap-3">
        {/* Audio Notification Status */}
        <button
          onClick={enableAudio}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all shadow-sm ${
            audioEnabled 
              ? isAudioContextSuspended 
                ? "bg-orange-100 text-orange-600 border border-orange-200 animate-pulse" 
                : "bg-green-100 text-green-600 border border-green-200"
              : "bg-gray-100 text-gray-400 border border-gray-200 hover:bg-gray-200"
          }`}
          title={audioEnabled ? (isAudioContextSuspended ? "Click para activar sonido" : "Sonido activo") : "Activar sonido de notificaciones"}
        >
          {audioEnabled ? (
            isAudioContextSuspended ? <VolumeX size={14} /> : <Volume2 size={14} />
          ) : (
            <VolumeX size={14} />
          )}
          <span>{audioEnabled ? (isAudioContextSuspended ? "Desbloquear" : "Activo") : "Sin Sonido"}</span>
        </button>

        <Link
          href={`https://mmmsystem.vercel.app/`}
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
        <button className="flex items-center gap-2 text-sm font-semibold text-gray-800 hover:text-gray-900 transition-colors cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 text-xs font-bold border border-gray-200">
            {sucursalData?.nombre ? sucursalData.nombre.charAt(0).toUpperCase() : 'M'}
          </div>
          <span className="max-w-[150px] truncate">{sucursalData?.nombre || "MMM PIZZA ARTESANAL"}</span>
          <ChevronDown size={14} className="text-gray-400" />
        </button>
        <button className="text-gray-400 hover:text-gray-600 transition-colors text-lg">⋮</button>
      </div>
    </header>
  );
}
