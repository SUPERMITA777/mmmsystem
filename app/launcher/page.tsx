"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LauncherPage() {
  const router = useRouter();

  useEffect(() => {
    // Al abrir la PWA, intentamos ir al panel de pedidos de la última sucursal usada
    // Por defecto usamos "mmm" si no hay registro
    const lastTenant = localStorage.getItem("last_tenant") || "mmm";
    router.replace(`/${lastTenant}/admin/panel-pedidos`);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center animate-pulse">
        <div className="w-16 h-16 border-4 border-[#7B1FA2] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h2 className="text-lg font-bold text-gray-700">Iniciando Sistema...</h2>
        <p className="text-sm text-gray-500">Cargando entorno offline</p>
      </div>
    </div>
  );
}
