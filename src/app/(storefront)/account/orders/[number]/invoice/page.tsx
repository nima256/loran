import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { InvoiceSheet } from "@/components/admin/InvoiceSheet";
import { PrintButton } from "@/components/admin/PrintButton";
import { getCustomer } from "@/server/lib/session";
import { getCustomerOrder } from "@/server/services/order-queries";

/**
 * The customer's printable invoice.
 *
 * Server-rendered, and scoped to the signed-in customer inside the query — a
 * different customer's order number is indistinguishable from one that does
 * not exist.
 *
 * `InvoiceSheet` is shared with the admin panel so the store and the customer
 * always print the same figures for an order.
 */

export const dynamic = "force-dynamic";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const customer = await getCustomer();
  if (!customer) {
    redirect(`/auth/login?redirect=${encodeURIComponent(`/account/orders/${number}/invoice`)}`);
  }

  let order;
  try {
    order = await getCustomerOrder(customer.id, decodeURIComponent(number));
  } catch {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/account/orders/${order.number}`}
          className="inline-flex min-h-9 items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
        >
          <ArrowRight className="size-4" aria-hidden />
          بازگشت به سفارش
        </Link>
        <PrintButton label="چاپ فاکتور" />
      </div>

      <InvoiceSheet order={order} />
    </div>
  );
}
