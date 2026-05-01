import type { Metadata } from "next";
import "../globals.css";
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

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}

