import { handler, created, ok, readJson } from "@/server/lib/http";
import { requireCustomer } from "@/server/lib/session";
import { createAddress, listAddresses } from "@/server/services/customers";
import { addressSchema } from "@/server/schemas/account";

/** GET / POST /api/v1/account/addresses */

export const GET = handler(async () => {
  const customer = await requireCustomer();
  return ok({ addresses: await listAddresses(customer.id) });
});

export const POST = handler(async (request) => {
  const customer = await requireCustomer();
  const input = await readJson(request, addressSchema);
  const address = await createAddress(customer.id, input);
  return created({ address, addresses: await listAddresses(customer.id) });
});
