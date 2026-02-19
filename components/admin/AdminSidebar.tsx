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
  MonitorPlay
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin/settings", icon: Settings, label: "Configuraciones" },
  { href: "/admin/menu", icon: Box, label: "Menú" },
  { href: "/admin/panel-pedidos", icon: ClipboardList, label: "Panel de pedidos" },
  { href: "/admin/cajas", icon: CreditCard, label: "Cajas" },
  { href: "/admin/pedidos", icon: FileText, label: "Pedidos" },
  { href: "/admin/repartidores", icon: Truck, label: "Repartidores" },
  { href: "/admin/reportes", icon: BarChart3, label: "Reportes" },
  { href: "/admin/stock", icon: Package, label: "Stock" },
  { href: "/admin/clientes", icon: Users, label: "Clientes" },
  { href: "/admin/descuentos", icon: Percent, label: "Descuentos" },
  { href: "/admin/integ", icon: Plug, label: "Integraciones" },
  { href: "/admin/usuarios", icon: Users, label: "Usuarios" },
  { href: "/admin/permisos", icon: Shield, label: "Permisos" },
  { href: "/admin/monitor-cocina", icon: MonitorPlay, label: "Monitor cocina" },
  { href: "/admin/facturacion-arca", icon: Store, label: "Facturación ARCA" }
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-slate-900 text-white flex flex-col">
      <div className="px-5 py-4 border-b border-slate-800">
        <h1 className="text-xl font-bold text-orange-500">MMM System</h1>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3 text-[13px]">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 mb-1 ${
                active ? "bg-white text-slate-900" : "hover:bg-slate-800"
              }`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

