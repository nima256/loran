import "server-only";
import { PrismaClient } from "@prisma/client";
import { env } from "./env";

/**
 * A single Prisma client per process.
 *
 * Next.js reloads modules on every edit in development, so the client is parked
 * on `globalThis` to avoid exhausting the connection pool.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isProduction ? ["error"] : ["error", "warn"],
  });

if (!env.isProduction) globalForPrisma.prisma = prisma;

/** The transaction-scoped client type, for services that run inside `$transaction`. */
export type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export type Db = PrismaClient | Tx;
