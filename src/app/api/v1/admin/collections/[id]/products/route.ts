import { ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { assignProductsToCollection, listCollectionProducts } from "@/server/services/taxonomy";
import { collectionProductsSchema } from "@/server/schemas/admin";
import { revalidateStorefront } from "@/server/lib/revalidate";

/**
 * GET /api/v1/admin/collections/[id]/products — the collection's products.
 * PUT — moves `{ productIds }` into this collection (each product has exactly
 * one collection, so this takes them out of their previous one).
 */

type Params = { id: string };

export const GET = adminRoute<Params>(async (_request, { params }) =>
  ok({ products: await listCollectionProducts(params.id) })
);

export const PUT = adminRoute<Params>(async (request, { params, audit }) => {
  const { productIds } = await adminBody(request, collectionProductsSchema);
  const result = await assignProductsToCollection(params.id, productIds);

  await audit({
    action: "collection.products",
    entityType: "collection",
    entityId: params.id,
    summary: `${result.moved} محصول به کالکشن منتقل شد`,
    meta: { productIds },
  });
  revalidateStorefront();

  return ok(result);
});
