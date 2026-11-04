import { notFound } from "next/navigation";
import { RunwayProductDetail } from "@/components/runway-product-detail";
import { findRunwayProduct } from "@/lib/runway";

export default async function OutfitProductPage({
  params,
}: {
  params: Promise<{ lookId: string; productId: string }>;
}) {
  const { lookId, productId } = await params;
  const result = findRunwayProduct(lookId, productId);
  if (!result) notFound();
  return <RunwayProductDetail key={`${lookId}-${productId}`} {...result} />;
}
