"use client";

import {
  Settings,
  ClipboardList,
  FileText,
  Package,
  Users,
  Percent,
  Plug,
  Shield,
  Store,
  BarChart3,
  Truck,
  Box,
  CreditCard,
  MonitorPlay,
  UtensilsCrossed,
  UserCheck,
  QrCode,
  ChevronLeft,
  ChevronRight,
  X,
  Bot
} from "lucide-react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useTenant } from "@/context/TenantContext";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAdminUI } from "@/context/AdminUIContext";

const items = [
  { id: "settings", href: "/admin/settings", icon: Settings, label: "Configuraciones" },
  { id: "menu", href: "/admin/menu", icon: UtensilsCrossed, label: "Menú" },
  { id: "panel-pedidos", href: "/admin/panel-pedidos", icon: ClipboardList, label: "Panel de pedidos" },
  { id: "cajas", href: "/admin/cajas", icon: CreditCard, label: "Cajas" },
  { id: "pedidos", href: "/admin/pedidos", icon: FileText, label: "Pedidos" },
  { id: "repartidores", href: "/admin/repartidores", icon: Truck, label: "Repartidores" },
  { id: "reportes", href: "/admin/reportes", icon: BarChart3, label: "Reportes" },
  { id: "stock", href: "/admin/stock", icon: Package, label: "Stock" },
  { id: "clientes", href: "/admin/clientes", icon: Users, label: "Clientes" },
  { id: "descuentos", href: "/admin/descuentos", icon: Percent, label: "Descuentos" },
  { id: "promo-qr", href: "/admin/promos", icon: QrCode, label: "Promos" },
  { id: "agente-ia", href: "/admin/agente-ia", icon: Bot, label: "Agente IA" },
  { id: "integraciones", href: "/admin/integraciones", icon: Plug, label: "Integraciones" },
  { id: "usuarios", href: "/admin/usuarios", icon: UserCheck, label: "Usuarios" },
  { id: "permisos", href: "/admin/permisos", icon: Shield, label: "Permisos" },
  { id: "monitor-cocina", href: "/admin/monitor-cocina", icon: MonitorPlay, label: "Monitor cocina" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const params = useParams();
  const { sucursalId } = useTenant();
  const { isSidebarCollapsed, toggleSidebar, isMobileSidebarOpen, closeMobileSidebar } = useAdminUI();
  const [modulosOcultos, setModulosOcultos] = useState<string[]>([]);

  useEffect(() => {
    if (sucursalId) {
      const fetchSettings = async () => {
        const { data } = await supabase
          .from("config_sucursal")
          .select("panel_settings")
          .eq("sucursal_id", sucursalId)
          .maybeSingle();
        
        if (data?.panel_settings?.modulos_ocultos) {
          setModulosOcultos(data.panel_settings.modulos_ocultos);
        }
      };
      fetchSettings();
    }
  }, [sucursalId]);

  const tenant = params?.tenant || pathname.split('/')[1] || "demo";

  const dynamicItems = items
    .filter(item => !modulosOcultos.includes(item.id))
    .map(item => ({
      ...item,
      href: `/${tenant}${item.href}`
    }));

  const sidebarWidth = isSidebarCollapsed ? "w-20" : "w-64";

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[60] lg:hidden backdrop-blur-sm transition-opacity"
          onClick={closeMobileSidebar}
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={`
          flex flex-col bg-white border-r border-gray-200 shrink-0 transition-all duration-300 ease-in-out z-[70]
          ${isMobileSidebarOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0 lg:static"}
          ${!isMobileSidebarOpen && "fixed lg:static inset-y-0 left-0"}
          ${!isMobileSidebarOpen ? sidebarWidth : "w-64"}
        `}
      >
        {/* Logo Section */}
        <div className={`px-5 py-6 flex items-center ${isSidebarCollapsed && !isMobileSidebarOpen ? 'justify-center' : 'justify-between'}`}>
          {(!isSidebarCollapsed || isMobileSidebarOpen) && (
            <h1 className="text-xl font-black text-gray-900 tracking-tight whitespace-nowrap overflow-hidden transition-all duration-300">
              MMM <span className="text-[#7B1FA2]">SYSTEM</span>
            </h1>
          )}
          {isSidebarCollapsed && !isMobileSidebarOpen && (
            <div className="w-10 h-10 bg-[#7B1FA2] rounded-xl flex items-center justify-center text-white font-black text-lg">
              M
            </div>
          )}
          <button 
            onClick={closeMobileSidebar}
            className="lg:hidden p-1 text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 text-[13px] custom-scrollbar">
          {dynamicItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => { if (window.innerWidth < 1024) closeMobileSidebar(); }}
                className={`
                  flex items-center rounded-xl mb-1 transition-all duration-200 group
                  ${isSidebarCollapsed && !isMobileSidebarOpen ? 'justify-center px-0 py-3' : 'gap-3 px-4 py-2.5'}
                  ${active
                    ? "bg-[#7B1FA2] text-white font-semibold shadow-md shadow-purple-200"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }
                `}
                title={isSidebarCollapsed ? item.label : ""}
              >
                <div className={`shrink-0 ${active ? "scale-110" : "group-hover:scale-110 transition-transform"}`}>
                  <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
                </div>
                {(!isSidebarCollapsed || isMobileSidebarOpen) && (
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis transition-opacity duration-300">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Collapse Toggle (Desktop only) */}
        <div className="hidden lg:flex p-4 border-t border-gray-100 justify-center">
          <button 
            onClick={toggleSidebar}
            className="p-2 rounded-lg bg-gray-50 text-gray-400 hover:text-[#7B1FA2] hover:bg-purple-50 transition-colors"
          >
            {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* User / Logout Section */}
        <div className={`p-4 border-t border-gray-50 bg-gray-50/30 ${isSidebarCollapsed && !isMobileSidebarOpen ? 'items-center' : ''} flex gap-3`}>
          <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center text-white text-sm font-bold shrink-0 border-2 border-white shadow-sm">
            N
          </div>
          {(!isSidebarCollapsed || isMobileSidebarOpen) && (
            <div className="flex flex-col justify-center overflow-hidden">
              <span className="text-sm font-semibold text-gray-900 truncate">Administrador</span>
              <span className="text-[10px] text-gray-500 truncate">Admin Mode</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
