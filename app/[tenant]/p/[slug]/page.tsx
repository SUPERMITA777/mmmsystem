import { RuletaClientView } from "@/components/promo/RuletaClientView";
import { supabase } from "@/lib/supabaseClient";
import { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ tenant: string, slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  
  const { data: ruleta } = await supabase
    .from("ruletas")
    .select("nombre, subtitulo_logo")
    .eq("short_code", slug)
    .maybeSingle();

  if (!ruleta) {
    return {
      title: "Ruleta de Premios",
    };
  }

  return {
    title: ruleta.nombre,
    description: ruleta.subtitulo_logo || "¡Girá la ruleta y ganá premios exclusivos!",
    openGraph: {
      title: ruleta.nombre,
      description: ruleta.subtitulo_logo || "¡Girá la ruleta y ganá premios exclusivos!",
      images: ["/og-ruleta.png"], // Opcional: podrías poner una imagen genérica de ruleta
    },
  };
}

export default async function PublicPromoPage({ params }: { params: Promise<{ tenant: string, slug: string }> }) {
  const { tenant, slug } = await params;
  return <RuletaClientView slug={slug} tenant={tenant} />;
}
