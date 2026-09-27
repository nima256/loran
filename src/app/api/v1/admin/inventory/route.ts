import { z } from "zod";
import { ok } from "@/server/lib/http";
import { adminRoute } from "@/server/lib/admin-route";
import { prisma } from "@/server/lib/prisma";
import { getInventorySummary } from "@/server/services/analytics";
import { paginated, paginationArgs, paginationSchema } from "@/server/lib/validation";
import { normalizePersian } from "@/lib/persian";
import type { Prisma } from "@prisma/client";

/** GET /api/v1/admin/inventory — variant-level stock, paginated server-side. */

const filterSchema = paginationSchema.extend({
  q: z.string().max(120).optional(),
  stock: z.enum(["all", "low", "out"]).default("all"),
  sort: z.enum(["stock-asc", "stock-desc", "name"]).default("stock-asc"),
});

export const GET = adminRoute(async (request) => {
  const url = new URL(request.url);
  const filters = filterSchema.parse(Object.fromEntries(url.searchParams.entries()));

  const where: Prisma.ProductVariantWhereInput = { product: { active: true }, active: true };
  if (filters.stock === "out") where.stock = 0;
  if (filters.stock === "low") where.stock = { gt: 0, lte: 3 };

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { sku: { contains: q, mode: "insensitive" } },
      { product: { searchText: { contains: normalizePersian(q) } } },
    ];
  }

  const orderBy: Prisma.ProductVariantOrderByWithRelationInput =
    filters.sort === "stock-desc"
      ? { stock: "desc" }
      : filters.sort === "name"
        ? { product: { name: "asc" } }
        : { stock: "asc" };

  const [total, rows, summary] = await Promise.all([
    prisma.productVariant.count({ where }),
    prisma.productVariant.findMany({
      where,
      orderBy,
      include: {
        product: { select: { id: true, name: true, slug: true, price: true } },
        color: { select: { name: true, hex: true } },
        size: { select: { value: true } },
      },
      ...paginationArgs(filters),
    }),
    getInventorySummary(),
  ]);

  return ok({
    ...paginated(
      rows.map((row) => ({
        variantId: row.id,
        productId: row.product.id,
        productName: row.product.name,
        productSlug: row.product.slug,
        sku: row.sku,
        colorName: row.color.name,
        colorHex: row.color.hex,
        size: row.size.value,
        stock: row.stock,
        price: row.price ?? row.product.price,
      })),
      total,
      filters
    ),
    summary,
  });
});
