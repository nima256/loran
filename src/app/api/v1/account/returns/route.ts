import { z } from "zod";
import { handler, created, ok, readJson } from "@/server/lib/http";
import { requireCustomer } from "@/server/lib/session";
import { cuidSchema, optionalText, text } from "@/server/lib/validation";
import {
  createReturnRequest,
  listCustomerReturns,
  listReturnableOrders,
} from "@/server/services/returns";

/**
 * GET / POST /api/v1/account/returns — exchange requests.
 *
 * The shop is exchange-only, so `type` can only be "exchange" (and defaults to
 * it); the service refuses anything else as well.
 */

const createSchema = z.object({
  orderId: cuidSchema,
  type: z.literal("exchange", { message: "فقط امکان ثبت درخواست تعویض وجود دارد." }).default("exchange"),
  reason: text(3, 200, "دلیل درخواست را انتخاب کنید."),
  customerNote: optionalText(1000),
  items: z
    .array(z.object({ orderItemId: cuidSchema, quantity: z.coerce.number().int().min(1).max(20) }))
    .min(1, { message: "حداقل یک کالا را انتخاب کنید." })
    .max(20),
});

export const GET = handler(async () => {
  const customer = await requireCustomer();
  const [requests, eligibleOrders] = await Promise.all([
    listCustomerReturns(customer.id),
    listReturnableOrders(customer.id),
  ]);
  return ok({ requests, eligibleOrders });
});

export const POST = handler(async (request) => {
  const customer = await requireCustomer();
  const input = await readJson(request, createSchema);
  const result = await createReturnRequest({ ...input, customerId: customer.id });
  return created({
    request: result,
    requests: await listCustomerReturns(customer.id),
  });
});
