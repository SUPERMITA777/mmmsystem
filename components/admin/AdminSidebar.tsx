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
  UserCheck
} from "lucide-react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useTenant } from "@/context/TenantContext";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

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
  { id: "integraciones", href: "/admin/integraciones", icon: Plug, label: "Integraciones" },
  { id: "usuarios", href: "/admin/usuarios", icon: UserCheck, label: "Usuarios" },
  { id: "permisos", href: "/admin/permisos", icon: Shield, label: "Permisos" },
  { id: "monitor-cocina", href: "/admin/monitor-cocina", icon: MonitorPlay, label: "Monitor cocina" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const params = useParams();
  const { sucursalId } = useTenant();
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

  // Extract tenant from params or pathname fallback
  const tenant = params?.tenant || pathname.split('/')[1] || "demo";

  // Rebuild items dynamically based on the current tenant and visibility settings
  const dynamicItems = items
    .filter(item => !modulosOcultos.includes(item.id))
    .map(item => ({
      ...item,
      href: `/${tenant}${item.href}`
    }));

  return (
    <aside className="w-56 bg-white flex flex-col border-r border-gray-200 shrink-0">
      {/* Logo */}
      <div className="px-5 py-4">
        <h1 className="text-xl font-black text-gray-900 tracking-tight">MMM SYSTEM</h1>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-3 py-1 text-[13px]">
        {dynamicItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 mb-0.5 transition-all ${active
                ? "bg-[#7B1FA2] text-white font-semibold shadow-sm"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
            >
              <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Avatar */}
      <div className="p-3 border-t border-gray-100">
        <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-white text-xs font-bold">
          N
        </div>
      </div>
    </aside>
  );
}
