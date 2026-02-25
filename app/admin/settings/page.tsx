"use client";

import { useState } from "react";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { ModalidadesTab } from "@/components/settings/ModalidadesTab";
import { PedidosTab } from "@/components/settings/PedidosTab";
import { HorariosTab } from "@/components/settings/HorariosTab";
import { MetodosPagoTab } from "@/components/settings/MetodosPagoTab";
import { ZonasEntregaTab } from "@/components/settings/ZonasEntregaTab";
import { RedesSocialesTab } from "@/components/settings/RedesSocialesTab";
import { MarketingTab } from "@/components/settings/MarketingTab";
import { ComandasTab } from "@/components/settings/ComandasTab";

const TABS = [
  { id: "modalidades", label: "Modalidades" },
  { id: "pedidos", label: "Pedidos" },
  { id: "horarios", label: "Horarios" },
  { id: "metodos_pago", label: "Métodos de pago" },
  { id: "zonas", label: "Zonas de entrega" },
  { id: "redes", label: "Redes sociales" },
  { id: "marketing", label: "Marketing" },
  { id: "comandas", label: "Comandas" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("modalidades");

  return (
    <section className="p-8">
      {/* Sucursal header */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">MMM Pizza</h2>
        <div className="flex items-center justify-center gap-4 mt-1">
          <button className="text-sm text-purple-600 hover:underline font-medium">Editar</button>
          <button className="text-sm text-purple-600 hover:underline font-medium">Obtener QR</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
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
          <ZonasEntregaTab />
        </TabPanel>

        <TabPanel id="redes" activeId={activeTab}>
          <RedesSocialesTab />
        </TabPanel>

        <TabPanel id="marketing" activeId={activeTab}>
          <MarketingTab />
        </TabPanel>

        <TabPanel id="comandas" activeId={activeTab}>
          <ComandasTab />
        </TabPanel>
      </div>
    </section>
  );
}
