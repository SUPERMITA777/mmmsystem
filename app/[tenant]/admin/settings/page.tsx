"use client";

import { useState } from "react";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { useTenant } from "@/context/TenantContext";
import { ModalidadesTab } from "@/components/settings/ModalidadesTab";
import { PedidosTab } from "@/components/settings/PedidosTab";
import { HorariosTab } from "@/components/settings/HorariosTab";
import { MetodosPagoTab } from "@/components/settings/MetodosPagoTab";
import { ZonasEntregaTab } from "@/components/settings/ZonasEntregaTab";
import { RedesSocialesTab } from "@/components/settings/RedesSocialesTab";
import { MarketingTab } from "@/components/settings/MarketingTab";
import { ComandasTab } from "@/components/settings/ComandasTab";
import { ImpresorasTab } from "@/components/settings/ImpresorasTab";
import { LocalidadesTab } from "@/components/settings/LocalidadesTab";
import { PanelTab } from "@/components/settings/PanelTab";
import { DatabaseTab } from "@/components/settings/DatabaseTab";
import { WebConfigTab } from "@/components/settings/WebConfigTab";

const TABS = [
  { id: "panel", label: "Panel" },
  { id: "web", label: "🌐 Web" },
  { id: "modalidades", label: "Modalidades" },
  { id: "pedidos", label: "Pedidos" },
  { id: "horarios", label: "Horarios" },
  { id: "metodos_pago", label: "Métodos de pago" },
  { id: "zonas", label: "Zonas de entrega" },
  { id: "redes", label: "Redes sociales" },
  { id: "marketing", label: "Marketing" },
  { id: "comandas", label: "Comandas" },
  { id: "impresoras", label: "Impresoras" },
  { id: "localidades", label: "Localidades" },
  { id: "database", label: "Base de datos" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("panel");
  const { sucursalData } = useTenant();

  return (
    <section className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto transition-all duration-300">
      {/* Sucursal header - More compact */}
      <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4 text-center md:text-left">
          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-[#7B1FA2] font-black text-xl border border-purple-200">
            {sucursalData?.nombre?.charAt(0).toUpperCase() || "M"}
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold text-gray-900 leading-tight">
              {sucursalData?.nombre || "MMM Pizza Artesanal"}
            </h2>
            <p className="text-xs text-gray-500">Configuración de sucursal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-4 py-1.5 text-xs bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-all">
            Editar Perfil
          </button>
          <button className="px-4 py-1.5 text-xs bg-[#7B1FA2] text-white rounded-lg hover:opacity-90 font-semibold shadow-sm transition-all">
            Obtener QR
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6 shadow-sm overflow-hidden lg:overflow-visible">
        <Tabs tabs={TABS} initialId={activeTab} onChange={setActiveTab} />

        <div className="mt-6 animation-fade-in">
          <TabPanel id="panel" activeId={activeTab}>
            <PanelTab />
          </TabPanel>

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

          <TabPanel id="impresoras" activeId={activeTab}>
            <ImpresorasTab />
          </TabPanel>

          <TabPanel id="localidades" activeId={activeTab}>
            <LocalidadesTab />
          </TabPanel>

          <TabPanel id="web" activeId={activeTab}>
            <WebConfigTab />
          </TabPanel>

          <TabPanel id="database" activeId={activeTab}>
            <DatabaseTab />
          </TabPanel>
        </div>
      </div>
    </section>
  );
}
