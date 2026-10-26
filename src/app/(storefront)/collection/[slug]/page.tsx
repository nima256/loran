import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/Navigation";
import { ShopView } from "@/components/shop/ShopView";
import {
  getCollectionBySlug,
  getFacets,
  listBrands,
  listCategories,
  searchProducts,
} from "@/server/services/catalog";
import { parseFilters, type RawParams } from "@/lib/shop-params";
import { applyContext, collectionContext } from "@/lib/shop-context";
import { isLocalUpload } from "@/lib/media";

/** A collection's product listing — the target of the homepage collection cards. */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollectionBySlug(decodeURIComponent(slug));
  if (!collection) return { title: "کالکشن پیدا نشد" };
  return { title: collection.name, description: collection.description };
}

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawParams>;
}) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const collection = await getCollectionBySlug(slug);
  if (!collection) notFound();

  const raw = await searchParams;
  const context = collectionContext(collection.slug, collection.name);
  const filters = applyContext(parseFilters(raw), context);

  const [result, facets, categories, brands] = await Promise.all([
    searchProducts(filters),
    getFacets(),
    listCategories(),
    listBrands(),
  ]);

  return (
    <>
      <div className="container-page pt-5">
        <Breadcrumbs
          items={[
            { label: "خانه", href: "/" },
            { label: "فروشگاه", href: "/shop" },
            { label: collection.name },
          ]}
        />
        {collection.image && (
          <div className="relative mt-4 aspect-[3/1] overflow-hidden rounded-xl border border-border bg-surface-inset sm:aspect-[4/1]">
            <Image
              src={collection.image}
              unoptimized={isLocalUpload(collection.image)}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          </div>
        )}
      </div>
      <ShopView
        result={result}
        filters={filters}
        facets={facets}
        categories={categories}
        brands={brands}
        basePath={`/collection/${collection.slug}`}
        heading={collection.name}
        description={collection.description}
        context={context}
      />
    </>
  );
}
