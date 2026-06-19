import type { Metadata } from "next";
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
    .select('mundial_og_title, mundial_og_description, logo_url')
    .eq('slug', params.tenant)
    .single();

  const title = sucursal?.mundial_og_title || "Copa Mundial - ¡Haz tu predicción!";
  const description = sucursal?.mundial_og_description || "Participa, acierta los resultados y gana premios increíbles.";
  const images = sucursal?.logo_url ? [sucursal.logo_url] : [];

  return {
    title,
    description,
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
  };
}

export default function MundialLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
