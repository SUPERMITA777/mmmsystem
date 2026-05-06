import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MMM SYSTEM",
  description: "El ecosistema definitivo para la gestión integral y automatizada de tu restaurante.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MMM System",
  },
};

export const viewport = {
  themeColor: "#070b19",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-[#070b19] text-slate-100 font-sans selection:bg-cyan-500/30 overflow-x-hidden relative">
        {children}
      </body>
    </html>
  );
}
