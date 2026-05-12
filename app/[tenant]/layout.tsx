import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";

import { createClient } from '@supabase/supabase-js';

type Props = {
  params: { tenant: string }
};

export async function generateMetadata(
  { params }: Props
): Promise<Metadata> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: sucursal } = await supabase
    .from('sucursales')
    .select('nombre, descripcion, logo_url')
    .eq('slug', params.tenant)
    .single();

  const title = sucursal?.nombre ? `${sucursal.nombre}` : "MMM SYSTEM DELIVERY";
  const description = sucursal?.descripcion || "Carta Digital y Delivery Online.";
  const images = sucursal?.logo_url ? [sucursal.logo_url] : [];

  return {
    title: {
      default: title,
      template: `%s | ${title}`,
    },
    description,
    manifest: "/manifest.json",
    openGraph: {
      title,
      description,
      images,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images,
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: title,
    },
  };
}

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

