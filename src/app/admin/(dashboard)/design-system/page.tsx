import { notFound } from "next/navigation";
import { DesignSystemGallery } from "@/components/admin/DesignSystemGallery";
import { getOnSale, getBestSellers } from "@/server/services/catalog";

/**
 * The design-system reference.
 *
 * A living style guide: every component here is the same one the storefront
 * uses. The example product card is rendered from a real catalogue row rather
 * than a fixture, so the guide cannot drift from what customers see.
 */

export const dynamic = "force-dynamic";

export default async function DesignSystemPage() {
  // A discounted product shows the most states at once (compare-at price,
  // discount badge); any product will do if nothing is on sale.
  const onSale = await getOnSale(1);
  const sample = onSale[0] ?? (await getBestSellers(1))[0];
  if (!sample) notFound();

  return <DesignSystemGallery sample={sample} />;
}
