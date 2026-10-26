import { ok } from "@/server/lib/http";
import { z } from "zod";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { deleteAdminCustomer, getAdminCustomer, updateAdminCustomer } from "@/server/services/admin-customers";
import { adminCustomerSchema } from "@/server/schemas/admin";

/** GET / PATCH / DELETE /api/v1/admin/customers/[id] */

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


const customerDeleteSchema = z.object({
  confirmationPhone: z.string().trim().min(1, "شماره موبایل مشتری را تأیید کنید."),
}).strict();

export const DELETE = adminRoute<Params>(async (request, { params, admin, ip }) => {
  const { confirmationPhone } = await adminBody(request, customerDeleteSchema);
  const result = await deleteAdminCustomer(params.id, confirmationPhone, {
    id: admin.id,
    email: admin.email,
    ip,
  });
  return ok({ ...result, message: "حساب مشتری حذف شد؛ سوابق سفارش و پرداخت باقی ماند." });
});
