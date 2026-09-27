import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { conflict, notFound } from "../lib/errors";
import { paginated, paginationArgs, type Pagination } from "../lib/validation";
import { normalizeIranMobile } from "@/lib/persian";
import { revokeAllCustomerSessions } from "../lib/session";
import { toUser } from "./customers";

/**
 * Customer administration.
 *
 * An administrator can create and edit a customer *profile*, but never a
 * credential: customers authenticate with phone + OTP, so there is no password
 * to set and no default to invent. A manually created customer signs in through
 * exactly the same OTP flow as everyone else — the admin has simply filled in
 * their details ahead of time.
 */

export interface AdminCustomerFilters extends Pagination {
  q?: string;
  status?: "active" | "blocked";
  sort?: "newest" | "orders" | "spend";
}

export async function listAdminCustomers(filters: AdminCustomerFilters) {
  const where: Prisma.CustomerWhereInput = {};
  if (filters.status) where.blocked = filters.status === "blocked";

  const q = filters.q?.trim();
  if (q) {
    const phone = normalizeIranMobile(q);
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: phone || q } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { orders: true } },
        orders: {
          where: { paymentStatus: "paid" },
          select: { payableOnline: true, createdAt: true },
        },
      },
      ...paginationArgs(filters),
    }),
  ]);

  const items = rows.map((row) => ({
    id: row.id,
    phone: row.phone,
    firstName: row.firstName ?? "",
    lastName: row.lastName ?? "",
    fullName: [row.firstName, row.lastName].filter(Boolean).join(" ") || "بدون نام",
    email: row.email ?? undefined,
    blocked: row.blocked,
    createdByAdmin: row.createdByAdmin,
    orderCount: row._count.orders,
    // Only paid orders count towards what a customer has actually spent.
    totalSpent: row.orders.reduce((n, o) => n + o.payableOnline, 0),
    lastOrderAt: row.orders.length
      ? new Date(Math.max(...row.orders.map((o) => o.createdAt.getTime()))).toISOString()
      : undefined,
    lastLoginAt: row.lastLoginAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }));

  // Sorts over derived aggregates are applied after the query rather than
  // pretending a column exists for them.
  if (filters.sort === "orders") items.sort((a, b) => b.orderCount - a.orderCount);
  if (filters.sort === "spend") items.sort((a, b) => b.totalSpent - a.totalSpent);

  return paginated(items, total, filters);
}

export type AdminCustomerListItem = Awaited<ReturnType<typeof listAdminCustomers>>["items"][number];

export interface AdminCustomerInput {
  phone: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  nationalId?: string;
  note?: string;
  blocked?: boolean;
  smsNotifications?: boolean;
}

export async function createAdminCustomer(input: AdminCustomerInput) {
  const phone = normalizeIranMobile(input.phone);
  if (!phone) throw conflict("شماره موبایل معتبر نیست.");

  const existing = await prisma.customer.findUnique({ where: { phone } });
  if (existing) throw conflict("مشتری با این شماره موبایل از قبل ثبت شده است.");

  try {
    const row = await prisma.customer.create({
      data: {
        phone,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        email: input.email ?? null,
        nationalId: input.nationalId ?? null,
        note: input.note ?? null,
        blocked: input.blocked ?? false,
        smsNotifications: input.smsNotifications ?? true,
        // Marked so the store knows this profile never came from a sign-in.
        createdByAdmin: true,
      },
    });
    return toUser(row);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw conflict("این ایمیل قبلاً برای مشتری دیگری ثبت شده است.");
    }
    throw error;
  }
}

export async function updateAdminCustomer(id: string, input: Partial<AdminCustomerInput>) {
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) throw notFound("مشتری پیدا نشد.");

  const phone = input.phone ? normalizeIranMobile(input.phone) : undefined;
  if (input.phone && !phone) throw conflict("شماره موبایل معتبر نیست.");

  if (phone && phone !== existing.phone) {
    const clash = await prisma.customer.findUnique({ where: { phone } });
    if (clash) throw conflict("مشتری دیگری با این شماره موبایل ثبت شده است.");
  }

  try {
    const row = await prisma.customer.update({
      where: { id },
      data: {
        ...(phone ? { phone } : {}),
        ...(input.firstName !== undefined ? { firstName: input.firstName || null } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName || null } : {}),
        ...(input.email !== undefined ? { email: input.email || null } : {}),
        ...(input.nationalId !== undefined ? { nationalId: input.nationalId || null } : {}),
        ...(input.note !== undefined ? { note: input.note || null } : {}),
        ...(input.blocked !== undefined ? { blocked: input.blocked } : {}),
        ...(input.smsNotifications !== undefined
          ? { smsNotifications: input.smsNotifications }
          : {}),
      },
    });

    // Blocking must take effect now, not when the customer's session expires.
    if (input.blocked === true && !existing.blocked) {
      await revokeAllCustomerSessions(id);
    }

    return toUser(row);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw conflict("این ایمیل قبلاً برای مشتری دیگری ثبت شده است.");
    }
    throw error;
  }
}

/** Full customer view: profile, addresses and order history. */
export async function getAdminCustomer(id: string) {
  const row = await prisma.customer.findUnique({
    where: { id },
    include: {
      addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          number: true,
          status: true,
          paymentStatus: true,
          grandTotal: true,
          payableOnline: true,
          createdAt: true,
          source: true,
        },
      },
    },
  });
  if (!row) throw notFound("مشتری پیدا نشد.");

  const paidOrders = row.orders.filter((o) => o.paymentStatus === "paid");

  return {
    ...toUser(row),
    blocked: row.blocked,
    note: row.note ?? undefined,
    createdByAdmin: row.createdByAdmin,
    lastLoginAt: row.lastLoginAt?.toISOString(),
    addresses: row.addresses.map((a) => ({
      id: a.id,
      title: a.title,
      recipient: `${a.recipientFirstName} ${a.recipientLastName}`.trim(),
      phone: a.phone,
      province: a.province,
      city: a.city,
      addressLine: a.addressLine,
      postalCode: a.postalCode,
      isDefault: a.isDefault,
    })),
    orders: row.orders.map((o) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      paymentStatus: o.paymentStatus,
      source: o.source,
      total: o.grandTotal,
      createdAt: o.createdAt.toISOString(),
    })),
    stats: {
      orderCount: row.orders.length,
      paidOrderCount: paidOrders.length,
      totalSpent: paidOrders.reduce((n, o) => n + o.payableOnline, 0),
    },
  };
}
