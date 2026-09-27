import "server-only";
import { Prisma, type DiscountType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { badRequest, conflict, notFound } from "../lib/errors";
import { paginated, paginationArgs, type Pagination } from "../lib/validation";
import { slugify } from "@/lib/persian";

/**
 * Coupon and campaign administration.
 *
 * Both are only ever *configured* here — what a coupon is worth on a given cart
 * is decided by `services/coupons`, and a campaign's effect on a price by
 * `services/pricing`, both server-side. The admin screen sets the rules; it
 * never computes a customer's discount.
 */

/* -------------------------------------------------------------------------- */
/* Coupons                                                                     */
/* -------------------------------------------------------------------------- */

export interface CouponInput {
  code: string;
  type: DiscountType;
  value: number;
  maxDiscount?: number | null;
  minSubtotal?: number | null;
  description?: string;
  active?: boolean;
  startsAt?: string | null;
  expiresAt?: string | null;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
}

function assertCouponSane(input: Partial<CouponInput>) {
  if (input.type === "percent" && input.value != null && (input.value <= 0 || input.value > 100)) {
    throw badRequest("درصد تخفیف باید بین ۱ تا ۱۰۰ باشد.");
  }
  if (input.type === "fixed" && input.value != null && input.value <= 0) {
    throw badRequest("مبلغ تخفیف باید بیشتر از صفر باشد.");
  }
  if (input.startsAt && input.expiresAt && new Date(input.startsAt) >= new Date(input.expiresAt)) {
    throw badRequest("تاریخ پایان باید بعد از تاریخ شروع باشد.");
  }
}

export async function createCoupon(input: CouponInput) {
  assertCouponSane(input);
  const code = input.code.trim().toUpperCase();

  const clash = await prisma.coupon.findUnique({ where: { code } });
  if (clash) throw conflict("کد تخفیف با این عنوان از قبل وجود دارد.");

  return prisma.coupon.create({
    data: {
      code,
      type: input.type,
      value: input.value,
      maxDiscount: input.maxDiscount ?? null,
      minSubtotal: input.minSubtotal ?? null,
      description: input.description ?? "",
      active: input.active ?? true,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      usageLimit: input.usageLimit ?? null,
      perCustomerLimit: input.perCustomerLimit ?? null,
    },
  });
}

export async function updateCoupon(id: string, input: Partial<CouponInput>) {
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) throw notFound("کد تخفیف پیدا نشد.");
  assertCouponSane({ ...existing, ...input } as Partial<CouponInput>);

  const code = input.code?.trim().toUpperCase();
  if (code && code !== existing.code) {
    const clash = await prisma.coupon.findUnique({ where: { code } });
    if (clash) throw conflict("کد تخفیف با این عنوان از قبل وجود دارد.");
  }

  // The usage counter is derived from real redemptions and is never editable.
  return prisma.coupon.update({
    where: { id },
    data: {
      ...(code ? { code } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.value !== undefined ? { value: input.value } : {}),
      ...(input.maxDiscount !== undefined ? { maxDiscount: input.maxDiscount } : {}),
      ...(input.minSubtotal !== undefined ? { minSubtotal: input.minSubtotal } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.startsAt !== undefined
        ? { startsAt: input.startsAt ? new Date(input.startsAt) : null }
        : {}),
      ...(input.expiresAt !== undefined
        ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null }
        : {}),
      ...(input.usageLimit !== undefined ? { usageLimit: input.usageLimit } : {}),
      ...(input.perCustomerLimit !== undefined
        ? { perCustomerLimit: input.perCustomerLimit }
        : {}),
    },
  });
}

/**
 * Archives a coupon that has been used, deletes one that has not.
 *
 * A used coupon's redemptions are part of an order's history, so the row has to
 * survive; archiving takes it out of circulation without breaking that link.
 */
export async function deleteCoupon(id: string) {
  const coupon = await prisma.coupon.findUnique({
    where: { id },
    include: { _count: { select: { redemptions: true, orders: true } } },
  });
  if (!coupon) throw notFound("کد تخفیف پیدا نشد.");

  if (coupon._count.redemptions > 0 || coupon._count.orders > 0) {
    await prisma.coupon.update({
      where: { id },
      data: { active: false, archivedAt: new Date() },
    });
    return {
      action: "archived" as const,
      message: `کد «${coupon.code}» در سفارش‌ها استفاده شده، بنابراین بایگانی شد و دیگر قابل استفاده نیست.`,
    };
  }

  await prisma.coupon.delete({ where: { id } });
  return { action: "deleted" as const, message: `کد تخفیف «${coupon.code}» حذف شد.` };
}

export interface CouponFilters extends Pagination {
  q?: string;
  status?: "active" | "inactive" | "expired" | "archived";
}

export async function listCoupons(filters: CouponFilters) {
  const where: Prisma.CouponWhereInput = {};
  const now = new Date();

  if (filters.status === "active") {
    where.active = true;
    where.archivedAt = null;
    where.OR = [{ expiresAt: null }, { expiresAt: { gte: now } }];
  }
  if (filters.status === "inactive") {
    where.active = false;
    where.archivedAt = null;
  }
  if (filters.status === "expired") where.expiresAt = { lt: now };
  if (filters.status === "archived") where.archivedAt = { not: null };

  const q = filters.q?.trim();
  if (q) where.code = { contains: q, mode: "insensitive" };

  const [total, rows] = await Promise.all([
    prisma.coupon.count({ where }),
    prisma.coupon.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { redemptions: { select: { amount: true } } },
      ...paginationArgs(filters),
    }),
  ]);

  return paginated(
    rows.map((row) => ({
      id: row.id,
      code: row.code,
      type: row.type,
      value: row.value,
      maxDiscount: row.maxDiscount,
      minSubtotal: row.minSubtotal,
      description: row.description,
      active: row.active,
      archived: row.archivedAt != null,
      expired: row.expiresAt != null && row.expiresAt < now,
      startsAt: row.startsAt?.toISOString(),
      expiresAt: row.expiresAt?.toISOString(),
      usageLimit: row.usageLimit,
      perCustomerLimit: row.perCustomerLimit,
      usageCount: row.usageCount,
      totalDiscount: row.redemptions.reduce((n, r) => n + r.amount, 0),
      createdAt: row.createdAt.toISOString(),
    })),
    total,
    filters
  );
}

export type AdminCoupon = Awaited<ReturnType<typeof listCoupons>>["items"][number];

/* -------------------------------------------------------------------------- */
/* Campaigns                                                                   */
/* -------------------------------------------------------------------------- */

export interface CampaignInput {
  name: string;
  slug?: string;
  description?: string;
  type: DiscountType;
  value: number;
  maxDiscount?: number | null;
  active?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  priority?: number;
  productIds: string[];
}

function assertCampaignSane(input: Partial<CampaignInput>) {
  if (input.type === "percent" && input.value != null && (input.value <= 0 || input.value > 100)) {
    throw badRequest("درصد تخفیف کمپین باید بین ۱ تا ۱۰۰ باشد.");
  }
  if (input.type === "fixed" && input.value != null && input.value <= 0) {
    throw badRequest("مبلغ تخفیف کمپین باید بیشتر از صفر باشد.");
  }
  if (input.startsAt && input.endsAt && new Date(input.startsAt) >= new Date(input.endsAt)) {
    throw badRequest("تاریخ پایان کمپین باید بعد از تاریخ شروع باشد.");
  }
}

export async function createCampaign(input: CampaignInput) {
  assertCampaignSane(input);
  const slug = input.slug?.trim() || slugify(input.name);

  const clash = await prisma.campaign.findUnique({ where: { slug } });
  if (clash) throw conflict("کمپینی با این نشانی از قبل وجود دارد.");

  return prisma.campaign.create({
    data: {
      slug,
      name: input.name,
      description: input.description ?? "",
      type: input.type,
      value: input.value,
      maxDiscount: input.maxDiscount ?? null,
      active: input.active ?? true,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      priority: input.priority ?? 0,
      products: { create: input.productIds.map((productId) => ({ productId })) },
    },
  });
}

export async function updateCampaign(id: string, input: Partial<CampaignInput>) {
  const existing = await prisma.campaign.findUnique({ where: { id } });
  if (!existing) throw notFound("کمپین پیدا نشد.");
  assertCampaignSane({ ...existing, ...input } as Partial<CampaignInput>);

  return prisma.$transaction(async (tx) => {
    const campaign = await tx.campaign.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.value !== undefined ? { value: input.value } : {}),
        ...(input.maxDiscount !== undefined ? { maxDiscount: input.maxDiscount } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.startsAt !== undefined
          ? { startsAt: input.startsAt ? new Date(input.startsAt) : null }
          : {}),
        ...(input.endsAt !== undefined
          ? { endsAt: input.endsAt ? new Date(input.endsAt) : null }
          : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
      },
    });

    if (input.productIds) {
      await tx.campaignProduct.deleteMany({ where: { campaignId: id } });
      await tx.campaignProduct.createMany({
        data: input.productIds.map((productId) => ({ campaignId: id, productId })),
        skipDuplicates: true,
      });
    }

    return campaign;
  });
}

/**
 * Deletes a campaign.
 *
 * Safe to hard-delete: a campaign only ever affected a *price at the time*, and
 * that price is already snapshotted onto any order it produced. Removing it
 * changes what the storefront charges from now on, nothing historical.
 */
export async function deleteCampaign(id: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) throw notFound("کمپین پیدا نشد.");
  await prisma.campaign.delete({ where: { id } });
  return { message: `کمپین «${campaign.name}» حذف شد.` };
}

export async function listCampaigns(filters: Pagination & { q?: string; status?: "active" | "scheduled" | "ended" | "inactive" }) {
  const where: Prisma.CampaignWhereInput = {};
  const now = new Date();

  if (filters.status === "active") {
    where.active = true;
    where.AND = [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
    ];
  }
  if (filters.status === "scheduled") where.startsAt = { gt: now };
  if (filters.status === "ended") where.endsAt = { lt: now };
  if (filters.status === "inactive") where.active = false;

  const q = filters.q?.trim();
  if (q) where.name = { contains: q, mode: "insensitive" };

  const [total, rows] = await Promise.all([
    prisma.campaign.count({ where }),
    prisma.campaign.findMany({
      where,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      include: {
        products: { include: { product: { select: { id: true, name: true, slug: true } } } },
      },
      ...paginationArgs(filters),
    }),
  ]);

  return paginated(
    rows.map((row) => {
      const started = !row.startsAt || row.startsAt <= now;
      const ended = row.endsAt != null && row.endsAt < now;
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        type: row.type,
        value: row.value,
        maxDiscount: row.maxDiscount,
        active: row.active,
        priority: row.priority,
        startsAt: row.startsAt?.toISOString(),
        endsAt: row.endsAt?.toISOString(),
        /** What the storefront is actually doing with it right now. */
        state: !row.active ? "inactive" : ended ? "ended" : !started ? "scheduled" : "active",
        productCount: row.products.length,
        products: row.products.map((p) => p.product),
        createdAt: row.createdAt.toISOString(),
      };
    }),
    total,
    filters
  );
}

export type AdminCampaign = Awaited<ReturnType<typeof listCampaigns>>["items"][number];
