import { MapaSalon } from "@/components/salon/MapaSalon";
import { TenantProvider } from "@/context/TenantContext";

export const metadata = {
  title: "Vista Mozos | MMM System",
  description: "Carga de pedidos para mozos",
};

export default function CamareroSalonPage() {
  return (
    <TenantProvider>
      <div className="h-screen flex flex-col overflow-hidden bg-slate-50">
        <MapaSalon isCamareroMode={true} />
      </div>
    </TenantProvider>
  );
}
