import { RuletaClientView } from "@/components/promo/RuletaClientView";

export default function PublicPromoPage({ params }: { params: { tenant: string, slug: string } }) {
  return <RuletaClientView slug={params.slug} tenant={params.tenant} />;
}
