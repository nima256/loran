import { ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { getAdminCustomer, updateAdminCustomer } from "@/server/services/admin-customers";
import { adminCustomerSchema } from "@/server/schemas/admin";

/** GET / PATCH /api/v1/admin/customers/[id] */

type Params = { id: string };

export const GET = adminRoute<Params>(async (_request, { params }) =>
  ok({ customer: await getAdminCustomer(params.id) })
);

export const PATCH = adminRoute<Params>(async (request, { params, audit }) => {
  const input = await adminBody(request, adminCustomerSchema.partial());
  const customer = await updateAdminCustomer(params.id, input);

  await audit({
    action: "customer.update",
    entityType: "customer",
    entityId: params.id,
    summary: `اطلاعات مشتری ${customer.phone} ویرایش شد`,
    meta: { blocked: input.blocked },
  });

  return ok({ customer });
});
