import { ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { setVariantStock } from "@/server/services/admin-products";
import { variantStockSchema } from "@/server/schemas/admin";
import { prisma } from "@/server/lib/prisma";

/** PATCH /api/v1/admin/products/[id]/variants/[variantId] — inline stock edit. */

type Params = { id: string; variantId: string };

export const PATCH = adminRoute<Params>(async (request, { params, audit }) => {
  const { stock } = await adminBody(request, variantStockSchema);

  const before = await prisma.productVariant.findUnique({
    where: { id: params.variantId },
    select: { stock: true, sku: true },
  });

  await setVariantStock(params.variantId, stock);

  await audit({
    action: "variant.update",
    entityType: "variant",
    entityId: params.variantId,
    summary: `موجودی ${before?.sku ?? params.variantId} از ${before?.stock ?? "?"} به ${stock} تغییر کرد`,
    meta: { from: before?.stock, to: stock },
  });

  return ok({ variantId: params.variantId, stock });
});
