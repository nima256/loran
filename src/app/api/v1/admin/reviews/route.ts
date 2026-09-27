import { z } from "zod";
import { ok } from "@/server/lib/http";
import { adminRoute } from "@/server/lib/admin-route";
import { prisma } from "@/server/lib/prisma";
import { paginated, paginationArgs, paginationSchema } from "@/server/lib/validation";
import type { Prisma } from "@prisma/client";

/** GET /api/v1/admin/reviews — the moderation queue. */

const filterSchema = paginationSchema.extend({
  q: z.string().max(120).optional(),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
});

export const GET = adminRoute(async (request) => {
  const url = new URL(request.url);
  const filters = filterSchema.parse(Object.fromEntries(url.searchParams.entries()));

  const where: Prisma.ReviewWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { authorName: { contains: q, mode: "insensitive" } },
      { body: { contains: q, mode: "insensitive" } },
      { product: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [total, rows, pendingCount] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      // Oldest pending first: the moderation queue should drain in order.
      orderBy: filters.status === "pending" ? { createdAt: "asc" } : { createdAt: "desc" },
      include: {
        product: { select: { id: true, name: true, slug: true } },
        customer: { select: { id: true, phone: true, firstName: true, lastName: true } },
      },
      ...paginationArgs(filters),
    }),
    prisma.review.count({ where: { status: "pending" } }),
  ]);

  return ok({
    ...paginated(
      rows.map((row) => ({
        id: row.id,
        rating: row.rating,
        title: row.title ?? undefined,
        body: row.body,
        status: row.status,
        authorName: row.authorName,
        verifiedPurchase: row.verifiedPurchase,
        sizeFeedback: row.sizeFeedback ?? undefined,
        purchasedColorName: row.purchasedColorName ?? undefined,
        purchasedSize: row.purchasedSize ?? undefined,
        moderationNote: row.moderationNote ?? undefined,
        createdAt: row.createdAt.toISOString(),
        product: row.product,
        customer: row.customer
          ? {
              id: row.customer.id,
              phone: row.customer.phone,
              name: [row.customer.firstName, row.customer.lastName].filter(Boolean).join(" "),
            }
          : null,
      })),
      total,
      filters
    ),
    pendingCount,
  });
});
