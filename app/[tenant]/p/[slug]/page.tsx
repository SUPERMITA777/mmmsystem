import { RuletaClientView } from "@/components/promo/RuletaClientView";

export default async function PublicPromoPage({ params }: { params: Promise<{ tenant: string, slug: string }> }) {
  const { tenant, slug } = await params;
  return <RuletaClientView slug={slug} tenant={tenant} />;
}
