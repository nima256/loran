import "server-only";
import { Prisma } from "@prisma/client";
import { prisma, type Db } from "../lib/prisma";
import { ApiError, conflict, notFound } from "../lib/errors";
import type { Address, User } from "@/types";

/**
 * Customer profiles and addresses.
 *
 * Customers authenticate by phone + OTP, so there is no password anywhere in
 * this module — an administrator creating a customer by hand creates the
 * profile only, and that person still signs in through the normal OTP flow.
 */

/** Maps a row to the `User` shape the existing UI already renders. */
export function toUser(row: {
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  nationalId: string | null;
  birthDate: Date | null;
  smsNotifications: boolean;
  createdAt: Date;
}): User {
  return {
    id: row.id,
    phone: row.phone,
    firstName: row.firstName ?? undefined,
    lastName: row.lastName ?? undefined,
    email: row.email ?? undefined,
    nationalId: row.nationalId ?? undefined,
    birthDate: row.birthDate?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    smsNotifications: row.smsNotifications,
  };
}

export function toAddress(row: {
  id: string;
  title: string;
  recipientFirstName: string;
  recipientLastName: string;
  phone: string;
  province: string;
  city: string;
  addressLine: string;
  postalCode: string;
  plaque: string | null;
  unit: string | null;
  isDefault: boolean;
}): Address {
  return {
    id: row.id,
    title: row.title,
    recipientFirstName: row.recipientFirstName,
    recipientLastName: row.recipientLastName,
    phone: row.phone,
    province: row.province,
    city: row.city,
    addressLine: row.addressLine,
    postalCode: row.postalCode,
    plaque: row.plaque ?? undefined,
    unit: row.unit ?? undefined,
    isDefault: row.isDefault,
  };
}

/**
 * Finds the customer for a verified phone number, creating one on first login.
 * Returns whether the profile still needs a name, which is what drives the
 * "complete your account" step in the existing sign-in UI.
 */
export async function findOrCreateByPhone(phone: string): Promise<{
  customer: Awaited<ReturnType<typeof prisma.customer.create>>;
  isNew: boolean;
}> {
  const existing = await prisma.customer.findUnique({ where: { phone } });
  if (existing) {
    if (existing.blocked) {
      throw new ApiError("forbidden", "دسترسی این حساب کاربری مسدود شده است.");
    }
    await prisma.customer.update({
      where: { id: existing.id },
      data: { lastLoginAt: new Date() },
    });
    return { customer: existing, isNew: false };
  }

  const customer = await prisma.customer.create({
    data: { phone, lastLoginAt: new Date() },
  });
  return { customer, isNew: true };
}

export async function getProfile(customerId: string): Promise<User> {
  const row = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!row) throw notFound("حساب کاربری پیدا نشد.");
  return toUser(row);
}

export interface ProfileInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  nationalId?: string;
  birthDate?: string;
  smsNotifications?: boolean;
}

export async function updateProfile(customerId: string, input: ProfileInput): Promise<User> {
  try {
    const row = await prisma.customer.update({
      where: { id: customerId },
      data: {
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.email !== undefined ? { email: input.email || null } : {}),
        ...(input.nationalId !== undefined ? { nationalId: input.nationalId || null } : {}),
        ...(input.birthDate !== undefined
          ? { birthDate: input.birthDate ? new Date(input.birthDate) : null }
          : {}),
        ...(input.smsNotifications !== undefined
          ? { smsNotifications: input.smsNotifications }
          : {}),
      },
    });
    return toUser(row);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw conflict("این ایمیل قبلاً برای حساب دیگری ثبت شده است.");
    }
    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/* Addresses                                                                   */
/* -------------------------------------------------------------------------- */

export async function listAddresses(customerId: string): Promise<Address[]> {
  const rows = await prisma.address.findMany({
    where: { customerId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  return rows.map(toAddress);
}

export interface AddressInput {
  title: string;
  recipientFirstName: string;
  recipientLastName: string;
  phone: string;
  province: string;
  city: string;
  addressLine: string;
  postalCode: string;
  plaque?: string;
  unit?: string;
  isDefault?: boolean;
}

export async function createAddress(customerId: string, input: AddressInput): Promise<Address> {
  return prisma.$transaction(async (tx) => {
    const count = await tx.address.count({ where: { customerId } });
    // The first address is always the default, whatever the request said.
    const isDefault = input.isDefault || count === 0;
    if (isDefault) await clearDefault(tx, customerId);

    const row = await tx.address.create({
      data: {
        customerId,
        title: input.title,
        recipientFirstName: input.recipientFirstName,
        recipientLastName: input.recipientLastName,
        phone: input.phone,
        province: input.province,
        city: input.city,
        addressLine: input.addressLine,
        postalCode: input.postalCode,
        plaque: input.plaque ?? null,
        unit: input.unit ?? null,
        isDefault,
      },
    });
    return toAddress(row);
  });
}

export async function updateAddress(
  customerId: string,
  addressId: string,
  input: Partial<AddressInput>
): Promise<Address> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({ where: { id: addressId, customerId } });
    if (!existing) throw notFound("آدرس پیدا نشد.");

    if (input.isDefault) await clearDefault(tx, customerId);

    const row = await tx.address.update({
      where: { id: addressId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.recipientFirstName !== undefined
          ? { recipientFirstName: input.recipientFirstName }
          : {}),
        ...(input.recipientLastName !== undefined
          ? { recipientLastName: input.recipientLastName }
          : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.province !== undefined ? { province: input.province } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.addressLine !== undefined ? { addressLine: input.addressLine } : {}),
        ...(input.postalCode !== undefined ? { postalCode: input.postalCode } : {}),
        ...(input.plaque !== undefined ? { plaque: input.plaque || null } : {}),
        ...(input.unit !== undefined ? { unit: input.unit || null } : {}),
        // An address can be promoted to default but never demoted directly —
        // that happens by promoting a different one.
        ...(input.isDefault ? { isDefault: true } : {}),
      },
    });
    return toAddress(row);
  });
}

export async function deleteAddress(customerId: string, addressId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({ where: { id: addressId, customerId } });
    if (!existing) throw notFound("آدرس پیدا نشد.");

    await tx.address.delete({ where: { id: addressId } });

    // Never leave the account without a default address.
    if (existing.isDefault) {
      const next = await tx.address.findFirst({
        where: { customerId },
        orderBy: { createdAt: "asc" },
      });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
}

export async function setDefaultAddress(customerId: string, addressId: string): Promise<Address[]> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({ where: { id: addressId, customerId } });
    if (!existing) throw notFound("آدرس پیدا نشد.");
    await clearDefault(tx, customerId);
    await tx.address.update({ where: { id: addressId }, data: { isDefault: true } });
  });
  return listAddresses(customerId);
}

async function clearDefault(tx: Db, customerId: string) {
  await tx.address.updateMany({ where: { customerId, isDefault: true }, data: { isDefault: false } });
}
