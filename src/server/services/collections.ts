import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/lib/prisma";
import { badRequest, conflict, notFound } from "@/server/lib/errors";
import { slugify } from "@/lib/persian";
import { getProduct } from "@/server/services/catalog";

export type StoreCollection = {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  image: string | null;
  active: boolean;
  position: number;
  productIds?: string[];
};

type CollectionInput = {
  name: string;
  slug?: string;
  subtitle?: string;
  image?: string | null;
  active?: boolean;
  position?: number;
  productIds?: string[];
};

export async function listCollections(includeInactive = false): Promise<StoreCollection[]> {
  const rows = await prisma.$queryRaw<StoreCollection[]>`
    SELECT id,slug,name,subtitle,image,active,position
    FROM storefront_collections
    WHERE (${includeInactive} OR active = TRUE)
    ORDER BY position ASC, "createdAt" ASC
  `;
  if (!includeInactive) return rows;
  const relations = await prisma.$queryRaw<{collectionId:string;productId:string}[]>`
    SELECT "collectionId", "productId" FROM storefront_collection_products
  `;
  const lookup = new Map<string,string[]>();
  for (const link of relations) lookup.set(link.collectionId, [...(lookup.get(link.collectionId) ?? []), link.productId]);
  return rows.map(row => ({ ...row, productIds: lookup.get(row.id) ?? [] }));
}

export async function getCollection(slug: string): Promise<StoreCollection | null> {
  const rows = await prisma.$queryRaw<StoreCollection[]>`
    SELECT id,slug,name,subtitle,image,active,position
    FROM storefront_collections WHERE slug = ${slug} AND active = TRUE LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getCollectionProducts(collectionId: string, limit = 100) {
  const rows = await prisma.$queryRaw<{ slug: string }[]>`
    SELECT p.slug FROM storefront_collection_products cp
    JOIN products p ON p.id = cp."productId"
    WHERE cp."collectionId" = ${collectionId} AND p.active = TRUE
    ORDER BY p."createdAt" DESC LIMIT ${Math.max(1, Math.min(100,limit))}
  `;
  return (await Promise.all(rows.map(row => getProduct(row.slug)))).filter((product): product is NonNullable<typeof product> => product != null);
}

async function replaceMembers(db: Prisma.TransactionClient, id: string, productIds: string[]) {
  const ids = [...new Set(productIds)];
  if (ids.length > 500) throw badRequest("حداکثر ۵۰۰ محصول قابل انتخاب است.");
  if (ids.length) {
    const found = await db.product.count({ where: { id: { in: ids } } });
    if (found !== ids.length) throw badRequest("یک یا چند محصول انتخاب‌شده وجود ندارند.");
  }
  await db.$executeRaw`DELETE FROM storefront_collection_products WHERE "collectionId" = ${id}`;
  for (const productId of ids) {
    await db.$executeRaw`INSERT INTO storefront_collection_products ("collectionId", "productId") VALUES (${id}, ${productId})`;
  }
}

export async function createCollection(input: CollectionInput) {
  const id = `col_${randomUUID()}`;
  const slug = input.slug?.trim() || slugify(input.name);
  if (!slug) throw badRequest("نشانی کالکشن معتبر نیست.");
  const exists = await prisma.$queryRaw<{id:string}[]>`SELECT id FROM storefront_collections WHERE slug = ${slug}`;
  if (exists.length) throw conflict("کالکشنی با این نشانی وجود دارد.");
  return prisma.$transaction(async db => {
    const rows = await db.$queryRaw<StoreCollection[]>`
      INSERT INTO storefront_collections (id,slug,name,subtitle,image,active,position)
      VALUES (${id},${slug},${input.name},${input.subtitle ?? ""},${input.image ?? null},${input.active ?? true},${input.position ?? 0})
      RETURNING id,slug,name,subtitle,image,active,position
    `;
    await replaceMembers(db, id, input.productIds ?? []);
    return rows[0];
  });
}

export async function updateCollection(id: string, input: Partial<CollectionInput>) {
  return prisma.$transaction(async db => {
    const found = await db.$queryRaw<StoreCollection[]>`
      SELECT id,slug,name,subtitle,image,active,position FROM storefront_collections WHERE id = ${id} FOR UPDATE
    `;
    if (!found.length) throw notFound("کالکشن پیدا نشد.");
    const prev = found[0];
    const slug = input.slug === undefined ? prev.slug : (input.slug.trim() || slugify(input.name ?? prev.name));
    const clashing = await db.$queryRaw<{id:string}[]>`
      SELECT id FROM storefront_collections WHERE slug = ${slug} AND id <> ${id}
    `;
    if (clashing.length) throw conflict("کالکشنی با این نشانی وجود دارد.");
    const rows = await db.$queryRaw<StoreCollection[]>`
      UPDATE storefront_collections SET slug = ${slug}, name = ${input.name ?? prev.name},
      subtitle = ${input.subtitle ?? prev.subtitle}, image = ${input.image === undefined ? prev.image : input.image},
      active = ${input.active ?? prev.active}, position = ${input.position ?? prev.position},
      "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${id}
      RETURNING id,slug,name,subtitle,image,active,position
    `;
    if (input.productIds !== undefined) await replaceMembers(db, id, input.productIds);
    return rows[0];
  });
}

export async function deleteCollection(id: string) {
  const removed = await prisma.$executeRaw`DELETE FROM storefront_collections WHERE id = ${id}`;
  if (!removed) throw notFound("کالکشن پیدا نشد.");
  // Memberships cascade; products and their order history stay untouched.
  return { deleted: true };
}
