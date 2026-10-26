import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getAdminOrder } from "@/server/services/order-queries";
import { PrintButton } from "@/components/admin/PrintButton";
import { siteConfig } from "@/lib/site-config";
import { formatDate, formatPhone, toPersianDigits } from "@/lib/format";

/**
 * Warehouse packing slip.
 *
 * A picking-and-packing document, not a tax invoice: no prices, no totals, no
 * VAT. What it carries is what somebody standing at the shelves needs — what to
 * pick, in which colour and size, how many, where it is going, and any note the
 * customer left.
 *
 * Laid out for A4 with the item table large enough to read at arm's length.
 */

export const dynamic = "force-dynamic";

export default async function PackingSlipPage({
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

  const totalUnits = order.items.reduce((n, item) => n + item.quantity, 0);

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
        <PrintButton label="چاپ برگه بسته‌بندی" />
      </div>

      <article className="print-sheet mx-auto max-w-3xl rounded-lg border border-border bg-white p-6 text-[#211d1a] shadow-e1 sm:p-8 dark:bg-white">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-[#211d1a] pb-4">
          <div>
            <h1 className="text-xl font-bold">برگه بسته‌بندی</h1>
            <p className="mt-1 text-xs text-[#5f564e]">{siteConfig.legalName}</p>
            <p className="mt-0.5 text-[0.7rem] text-[#8a8078]">
              این برگه سند مالی نیست و صرفاً برای آماده‌سازی مرسوله است.
            </p>
          </div>
          <div className="text-end">
            <p className="tnum text-lg font-bold" dir="ltr">{order.number}</p>
            <p className="mt-1 text-xs text-[#5f564e]">تاریخ سفارش: {formatDate(order.createdAt)}</p>
            <p className="tnum mt-0.5 text-xs text-[#5f564e]">
              تعداد کل اقلام: {toPersianDigits(totalUnits)} عدد
            </p>
          </div>
        </header>

        {/* Recipient — the block the courier label is written from. */}
        <section className="print-keep mt-5 grid gap-5 border-b border-[#e4dace] pb-5 text-sm sm:grid-cols-2">
          <div>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#8a8078]">گیرنده</h2>
            <p className="text-base font-bold">
              {order.address.recipientFirstName} {order.address.recipientLastName}
            </p>
            <p className="tnum mt-1" dir="ltr">{formatPhone(order.address.phone)}</p>
            <p className="mt-2 leading-7">
              {order.address.province}، {order.address.city}
              <br />
              {order.address.addressLine}
              {order.address.plaque && `، پلاک ${order.address.plaque}`}
              {order.address.unit && `، واحد ${order.address.unit}`}
            </p>
            <p className="tnum mt-1 font-medium">کد پستی: {toPersianDigits(order.address.postalCode)}</p>
          </div>

          <div>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#8a8078]">ارسال</h2>
            <p className="font-medium">{order.shippingMethodName}</p>
            {order.shippingPaidOnDelivery && (
              <p className="mt-1 font-bold text-[#9A1C21]">پس‌کرایه — کرایه از گیرنده دریافت شود.</p>
            )}
            {order.trackingCode && (
              <p className="tnum mt-2" dir="ltr">
                {order.carrier ?? ""} {order.trackingCode}
              </p>
            )}
            <h2 className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-[#8a8078]">سفارش‌دهنده</h2>
            <p>{order.customerName}</p>
            <p className="tnum" dir="ltr">{formatPhone(order.customerPhone)}</p>
          </div>
        </section>

        {/* Items — the picking list. Sized for reading at the shelf. */}
        <section className="mt-5">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-[#8a8078]">
            اقلام برای آماده‌سازی
          </h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-[#211d1a] text-end">
                <th scope="col" className="w-8 py-2 text-start font-bold">#</th>
                <th scope="col" className="py-2 text-start font-bold">کالا</th>
                <th scope="col" className="py-2 text-start font-bold">رنگ</th>
                <th scope="col" className="w-16 py-2 text-center font-bold">سایز</th>
                <th scope="col" className="w-20 py-2 text-center font-bold">تعداد</th>
                <th scope="col" className="w-28 py-2 text-start font-bold">کد کالا</th>
                {/* A tick box so the packer can mark off each line. */}
                <th scope="col" className="w-12 py-2 text-center font-bold">✓</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => (
                <tr key={`${item.variantId}-${index}`} className="border-b border-[#e4dace] align-top">
                  <td className="tnum py-3">{toPersianDigits(index + 1)}</td>
                  <td className="py-3 pe-2 font-medium">{item.name}</td>
                  <td className="py-3 pe-2">{item.colorName}</td>
                  <td className="tnum py-3 text-center text-base font-bold">
                    {toPersianDigits(item.size)}
                  </td>
                  <td className="tnum py-3 text-center text-base font-bold">
                    {toPersianDigits(item.quantity)}
                  </td>
                  <td className="tnum py-3 text-[0.7rem] text-[#5f564e]" dir="ltr">
                    {item.slug}
                  </td>
                  <td className="py-3 text-center">
                    <span className="inline-block size-5 border border-[#8a8078]" aria-hidden />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {order.customerNote && (
          <section className="print-keep mt-5 rounded border-2 border-dashed border-[#9A1C21] p-3">
            <h2 className="mb-1 text-xs font-bold text-[#9A1C21]">یادداشت مشتری</h2>
            <p className="text-sm leading-7">{order.customerNote}</p>
          </section>
        )}

        {order.adminNote && (
          <section className="print-keep mt-3 rounded bg-[#f3eee6] p-3">
            <h2 className="mb-1 text-xs font-bold text-[#5f564e]">یادداشت داخلی</h2>
            <p className="text-sm leading-7">{order.adminNote}</p>
          </section>
        )}

        <footer className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-[#e4dace] pt-4 text-xs text-[#5f564e]">
          <div>
            <p>آماده‌سازی توسط: ____________________</p>
            <p className="mt-3">تاریخ و ساعت: ____________________</p>
          </div>
          <p className="text-end">{siteConfig.domain}</p>
        </footer>
      </article>
    </div>
  );
}
