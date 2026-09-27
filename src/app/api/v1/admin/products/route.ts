import { created, ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { createProduct, listAdminProducts } from "@/server/services/admin-products";
import { productSchema, productFilterSchema } from "@/server/schemas/admin";

/** GET / POST /api/v1/admin/products */

export const GET = adminRoute(async (request) => {
  const url = new URL(request.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  const filters = productFilterSchema.parse(raw);
  return ok(await listAdminProducts(filters));
});

export const POST = adminRoute(async (request, { audit }) => {
  const input = await adminBody(request, productSchema);
  const product = await createProduct(input);

  await audit({
    action: "product.create",
    entityType: "product",
    entityId: product.id,
    summary: `محصول «${input.name}» ایجاد شد`,
    meta: { slug: product.slug, variants: input.variants.length },
  });

  return created({ product });
});
