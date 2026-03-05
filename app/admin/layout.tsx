import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { AiAssistantBar } from "@/components/admin/AiAssistantBar";
import { AuthProvider } from "@/components/admin/AuthProvider";
import versionData from "@/version.json";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen bg-[#f0f0f5]">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <AdminTopBar />
          <AiAssistantBar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
        <div className="fixed bottom-2 left-3 text-[10px] font-mono text-gray-400/60 select-none pointer-events-none z-50">
          Ver. {versionData.version}
        </div>
      </div>
    </AuthProvider>
  );
}
