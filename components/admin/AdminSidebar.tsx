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
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin/settings", icon: Settings, label: "Configuraciones" },
  { href: "/admin/menu", icon: UtensilsCrossed, label: "Menú" },
  { href: "/admin/panel-pedidos", icon: ClipboardList, label: "Panel de pedidos" },
  { href: "/admin/cajas", icon: CreditCard, label: "Cajas" },
  { href: "/admin/pedidos", icon: FileText, label: "Pedidos" },
  { href: "/admin/repartidores", icon: Truck, label: "Repartidores" },
  { href: "/admin/reportes", icon: BarChart3, label: "Reportes" },
  { href: "/admin/stock", icon: Package, label: "Stock" },
  { href: "/admin/clientes", icon: Users, label: "Clientes" },
  { href: "/admin/descuentos", icon: Percent, label: "Descuentos" },
  { href: "/admin/integraciones", icon: Plug, label: "Integraciones" },
  { href: "/admin/usuarios", icon: UserCheck, label: "Usuarios" },
  { href: "/admin/permisos", icon: Shield, label: "Permisos" },
  { href: "/admin/monitor-cocina", icon: MonitorPlay, label: "Monitor cocina" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-white flex flex-col border-r border-gray-200 shrink-0">
      {/* Logo */}
      <div className="px-5 py-4">
        <h1 className="text-xl font-black text-gray-900 tracking-tight">MMM SYSTEM</h1>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-3 py-1 text-[13px]">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
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
