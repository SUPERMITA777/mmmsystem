import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  title: "MMM SYSTEM DELIVERY",
  description: "POS en la nube para delivery, salón y mostrador",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MMM System",
  },
};

export const viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function TenantLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}

