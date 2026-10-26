import "server-only";
import { prisma } from "@/server/lib/prisma";
import { getProduct } from "@/server/services/catalog";

/** The editor saves tags in products.tags; home sections must query the same data. */
export async function getTaggedProducts(tag: "new" | "bestseller" | "sale", limit = 8) {
  const rows = await prisma.product.findMany({
    where: { active: true, tags: { has: tag } },
    select: { slug: true },
    orderBy: tag === "bestseller" ? [{ soldCount: "desc" }, { createdAt: "desc" }] : [{ createdAt: "desc" }],
    take: limit,
  });
  return (await Promise.all(rows.map(({ slug }) => getProduct(slug))))
    .filter((product): product is NonNullable<typeof product> => product !== null);
}
