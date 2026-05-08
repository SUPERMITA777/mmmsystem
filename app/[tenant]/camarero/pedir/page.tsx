import MobileOrderModule from "@/components/camarero/MobileOrderModule";
import { TenantProvider } from "@/context/TenantContext";
import { AuthProvider } from "@/components/admin/AuthProvider";

export const metadata = {
  title: "Carga de Pedido | MMM System",
  description: "Módulo móvil para toma de pedidos",
};

export default function PedirPage({ searchParams }: { searchParams: { mesa_id?: string } }) {
    const mesaId = searchParams.mesa_id || "";

    return (
        <TenantProvider>
            <AuthProvider>
                <div className="h-screen bg-slate-50">
                    <MobileOrderModule mesaId={mesaId} />
                </div>
            </AuthProvider>
        </TenantProvider>
    );
}
