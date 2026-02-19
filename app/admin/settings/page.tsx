"use client";

import { useState } from "react";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { ModalidadesTab } from "@/components/settings/ModalidadesTab";
import { PedidosTab } from "@/components/settings/PedidosTab";
import { HorariosTab } from "@/components/settings/HorariosTab";
import { MetodosPagoTab } from "@/components/settings/MetodosPagoTab";
import {
  ShoppingBag,
  Package,
  Clock,
  CreditCard,
  MapPin,
  MessageSquare,
  DollarSign,
} from "lucide-react";

const TABS = [
  { id: "modalidades", label: "Modalidades", icon: ShoppingBag },
  { id: "pedidos", label: "Pedidos", icon: Package },
  { id: "horarios", label: "Horarios", icon: Clock },
  { id: "metodos_pago", label: "Métodos de pago", icon: CreditCard },
  { id: "zonas", label: "Zonas de entrega", icon: MapPin },
  { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { id: "facturacion", label: "Facturación", icon: DollarSign },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("modalidades");

  return (
    <section className="p-8">
      <header className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-900">
          Configuraciones
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Ajusta cómo opera tu sucursal
        </p>
      </header>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <Tabs tabs={TABS} initialId={activeTab} onChange={setActiveTab} />

        <TabPanel id="modalidades" activeId={activeTab}>
          <ModalidadesTab />
        </TabPanel>

        <TabPanel id="pedidos" activeId={activeTab}>
          <PedidosTab />
        </TabPanel>

        <TabPanel id="horarios" activeId={activeTab}>
          <HorariosTab />
        </TabPanel>

        <TabPanel id="metodos_pago" activeId={activeTab}>
          <MetodosPagoTab />
        </TabPanel>

        <TabPanel id="zonas" activeId={activeTab}>
          <div className="text-center py-12 text-slate-500">
            <MapPin size={48} className="mx-auto mb-4 text-slate-300" />
            <p>Zonas de entrega - Próximamente</p>
          </div>
        </TabPanel>

        <TabPanel id="whatsapp" activeId={activeTab}>
          <div className="text-center py-12 text-slate-500">
            <MessageSquare size={48} className="mx-auto mb-4 text-slate-300" />
            <p>Configuración de WhatsApp - Próximamente</p>
          </div>
        </TabPanel>

        <TabPanel id="facturacion" activeId={activeTab}>
          <div className="text-center py-12 text-slate-500">
            <DollarSign size={48} className="mx-auto mb-4 text-slate-300" />
            <p>Configuración de Facturación - Próximamente</p>
          </div>
        </TabPanel>
      </div>
    </section>
  );
}

