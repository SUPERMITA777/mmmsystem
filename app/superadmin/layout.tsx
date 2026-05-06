import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MMM SUPERADMIN",
  description: "Panel de Control Global - MMM System"
};

export default function SuperAdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#060e20] text-slate-100 font-sans selection:bg-cyan-500/30">
      {children}
    </div>
  );
}
