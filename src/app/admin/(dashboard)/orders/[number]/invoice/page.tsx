import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { InvoiceSheet } from "@/components/admin/InvoiceSheet";
import { PrintButton } from "@/components/admin/PrintButton";
import { getAdminOrder } from "@/server/services/order-queries";

/**
 * The customer invoice, as the administrator sees it.
 *
 * Renders the same `InvoiceSheet` the customer's account area uses, so the
 * store and the customer can never print different figures for one order.
 */

export const dynamic = "force-dynamic";

export default async function AdminInvoicePage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;

  let order;
  try {
    order = await getAdminOrder(decodeURIComponent(number));
  } catch {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/admin/orders/${order.number}`}
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
