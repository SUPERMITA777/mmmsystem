import MobileOrderModule from "@/components/camarero/MobileOrderModule";
import { TenantProvider } from "@/context/TenantContext";
import { AuthProvider } from "@/components/admin/AuthProvider";

export const metadata = {
  title: "Carga de Pedido | MMM System",
  description: "Módulo móvil para toma de pedidos",
};

export default async function PedirPage({ searchParams }: { searchParams: Promise<{ mesa_id?: string; terminal?: string }> }) {
    const resolvedSearchParams = await searchParams;
    const mesaId = resolvedSearchParams.mesa_id || "";
    const terminal = resolvedSearchParams.terminal || "";

    return (
        <TenantProvider>
            <AuthProvider>
                <div className="h-screen bg-slate-50">
                    <MobileOrderModule mesaId={mesaId} terminal={terminal} />
                </div>
            </AuthProvider>
        </TenantProvider>
    );
}
