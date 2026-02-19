import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MMM SYSTEM DELIVERY",
  description: "POS en la nube para delivery, salón y mostrador"
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

