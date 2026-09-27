import "server-only";
import type { ShippingMethod as ShippingRow } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { badRequest } from "../lib/errors";
import type { ShippingMethod, ShippingMethodId } from "@/types";

/**
 * Shipping methods.
 *
 * Cost and eligibility are always recalculated here, never taken from the
 * client. Tipax is postpaid — the courier collects on delivery — so its cost is
 * reported separately and deliberately excluded from the amount charged online.
 */

export function toShippingMethod(row: ShippingRow): ShippingMethod {
  return {
    id: row.code as ShippingMethodId,
    name: row.name,
    description: row.description,
    cost: row.cost,
    paidOnDelivery: row.paidOnDelivery,
    estimate: row.estimate,
    available: row.active,
  };
}

export async function listShippingMethods(
  options: { activeOnly?: boolean } = {}
): Promise<ShippingMethod[]> {
  const rows = await prisma.shippingMethod.findMany({
    where: options.activeOnly ? { active: true } : {},
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
  return rows.map(toShippingMethod);
}

export interface ResolvedShipping {
  id: string;
  code: string;
  name: string;
  paidOnDelivery: boolean;
  /** The cost after the free-shipping rule has been applied. */
  cost: number;
  /** The method's list price, before any free-shipping rule. */
  baseCost: number;
  freeShippingApplied: boolean;
  estimate: string;
  supportsTracking: boolean;
}

/**
 * Resolves the method the customer picked and prices it for this subtotal.
 *
 * Falls back to the first active method when the request names one that is
 * missing or disabled, so a stale client can never wedge the checkout — but it
 * never silently keeps a *cheaper* cost: whatever is returned is what the order
 * is charged.
 */
export async function resolveShipping(
  code: string | undefined,
  subtotalAfterDiscounts: number
): Promise<ResolvedShipping> {
  const active = await prisma.shippingMethod.findMany({
    where: { active: true },
    orderBy: [{ position: "asc" }],
  });

  if (!active.length) {
    throw badRequest("در حال حاضر هیچ روش ارسالی فعال نیست. لطفاً با پشتیبانی تماس بگیرید.");
  }

  const row = active.find((m) => m.code === code) ?? active[0];

  const freeShippingApplied =
    row.freeShippingThreshold != null && subtotalAfterDiscounts >= row.freeShippingThreshold;

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    paidOnDelivery: row.paidOnDelivery,
    cost: freeShippingApplied ? 0 : row.cost,
    baseCost: row.cost,
    freeShippingApplied,
    estimate: row.estimate,
    supportsTracking: row.supportsTracking,
  };
}

/** Carriers an administrator may assign a tracking code for. */
export async function listTrackingCarriers(): Promise<{ code: string; name: string }[]> {
  const rows = await prisma.shippingMethod.findMany({
    where: { supportsTracking: true },
    orderBy: { position: "asc" },
    select: { code: true, name: true },
  });
  return rows;
}
