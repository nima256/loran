import "server-only";
import type { ZodType } from "zod";
import { handler, readJson, requestContext } from "./http";
import { requireAdmin, type AdminIdentity } from "./session";
import { recordAudit, type AuditAction } from "../services/audit";

/**
 * The wrapper every `/api/v1/admin/*` handler uses.
 *
 * It does three things the individual routes should not have to remember:
 * authenticate against the database, hand the handler the administrator's
 * identity, and make writing an audit entry a one-liner.
 *
 * The authentication here is independent of `middleware.ts`, which only checks
 * that a cookie exists and cannot reach the database from the Edge runtime.
 * This is the real check for the API surface.
 */

export interface AdminContext<Params = unknown> {
  admin: AdminIdentity;
  params: Params;
  ip: string | null;
  /** Writes an audit entry attributed to this administrator. */
  audit: (entry: {
    action: AuditAction;
    entityType: string;
    entityId?: string | null;
    summary: string;
    meta?: Record<string, unknown>;
  }) => Promise<void>;
}

type AdminHandler<Params> = (
  request: Request,
  context: AdminContext<Params>
) => Promise<Response> | Response;

/**
 * Next.js types a route handler's second argument as `{ params: Promise<T> }`
 * and rejects an optional one, so the wrapper matches that exactly and
 * tolerates a missing value at runtime for routes with no dynamic segment.
 */
export function adminRoute<Params = Record<string, never>>(fn: AdminHandler<Params>) {
  return handler<{ params: Promise<Params> }>(async (request, routeContext) => {
    const admin = await requireAdmin();
    const { ip } = requestContext(request);
    const params = ((await routeContext?.params) ?? {}) as Params;

    return fn(request, {
      admin,
      params,
      ip,
      audit: (entry) => recordAudit({ ...entry, admin, ip }),
    });
  });
}

/** Parses and validates a JSON body inside an admin route. */
export const adminBody = readJson;

export type { ZodType };
