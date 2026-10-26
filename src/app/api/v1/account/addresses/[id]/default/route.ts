import { handler, ok } from "@/server/lib/http";
import { requireCustomer } from "@/server/lib/session";
import { setDefaultAddress } from "@/server/services/customers";

/** POST /api/v1/account/addresses/[id]/default */

type Params = { params: Promise<{ id: string }> };

export const POST = handler<Params>(async (_request, { params }) => {
  const customer = await requireCustomer();
  const { id } = await params;
  return ok({ addresses: await setDefaultAddress(customer.id, id) });
});
