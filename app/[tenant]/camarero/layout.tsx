import { TenantProvider } from "@/context/TenantContext";
import { AuthProvider } from "@/components/admin/AuthProvider";
import SyncProvider from "@/components/admin/SyncProvider";

export default function CamareroLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <AuthProvider>
        <div className="min-h-screen">
          {children}
        </div>
        <SyncProvider />
      </AuthProvider>
    </TenantProvider>
  );
}
