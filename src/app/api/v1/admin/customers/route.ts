import { created, ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { createAdminCustomer, listAdminCustomers } from "@/server/services/admin-customers";
import { adminCustomerSchema, customerFilterSchema } from "@/server/schemas/admin";

/** GET / POST /api/v1/admin/customers */

export const GET = adminRoute(async (request) => {
  const url = new URL(request.url);
  const filters = customerFilterSchema.parse(Object.fromEntries(url.searchParams.entries()));
  return ok(await listAdminCustomers(filters));
});

export const POST = adminRoute(async (request, { audit }) => {
  const input = await adminBody(request, adminCustomerSchema);
  const customer = await createAdminCustomer(input);

  await audit({
    action: "customer.create",
    entityType: "customer",
    entityId: customer.id,
    summary: `مشتری ${customer.phone} به‌صورت دستی ایجاد شد`,
  });

  return created({
    customer,
    // Said explicitly so the administrator doesn't go looking for a password.
    message:
      "مشتری ثبت شد. ورود او مثل بقیه مشتریان با شماره موبایل و کد پیامکی انجام می‌شود و رمز عبوری لازم نیست.",
  });
});
