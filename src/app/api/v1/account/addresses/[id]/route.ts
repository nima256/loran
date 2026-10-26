import { handler, ok, readJson } from "@/server/lib/http";
import { requireCustomer } from "@/server/lib/session";
import { deleteAddress, listAddresses, updateAddress } from "@/server/services/customers";
import { addressSchema } from "@/server/schemas/account";

/** PATCH / DELETE /api/v1/account/addresses/[id] */

type Params = { params: Promise<{ id: string }> };

// Ownership is enforced inside the service: every query is scoped by
// `customerId`, so one customer can never reach another's address by id.

export const PATCH = handler<Params>(async (request, { params }) => {
  const customer = await requireCustomer();
  const { id } = await params;
  const input = await readJson(request, addressSchema.partial());
  await updateAddress(customer.id, id, input);
  return ok({ addresses: await listAddresses(customer.id) });
});

export const DELETE = handler<Params>(async (_request, { params }) => {
  const customer = await requireCustomer();
  const { id } = await params;
  await deleteAddress(customer.id, id);
  return ok({ addresses: await listAddresses(customer.id) });
});
