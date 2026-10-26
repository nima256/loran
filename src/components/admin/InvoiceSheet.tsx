import Image from "next/image";
import { PAYMENT_METHOD_LABELS } from "@/lib/orders";
import { formatAmount, formatDate, formatPhone, toPersianDigits } from "@/lib/format";
import { siteConfig } from "@/lib/site-config";
import type { OrderDetail } from "@/server/services/order-queries";

/**
 * The printable customer invoice.
 *
 * A simple, customer-friendly document — deliberately NOT a legal or tax
 * invoice: no VAT, no business identifiers. Rendered entirely from the order's
 * own snapshot, so an invoice printed today for an old order shows what was
 * actually bought and paid rather than today's catalogue.
 *
 * Shared by the customer's account area and the admin panel so the two can
 * never print different figures for the same order.
 */
export function InvoiceSheet({ order }: { order: OrderDetail }) {
  const itemsTotal = order.totals.subtotal + order.totals.productDiscount;

  return (
    <article className="print-sheet mx-auto max-w-3xl rounded-lg border border-border bg-white p-6 text-[#211d1a] shadow-e1 sm:p-8 dark:bg-white">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-[#9A1C21] pb-5">
        <div className="flex items-center gap-3">
          <span className="grid size-14 place-items-center rounded-[0.9rem] bg-[#9A1C21] p-2">
            <Image src="/brand/loran-mark-cream.png" alt="" width={44} height={44} className="h-full w-full object-contain" />
          </span>
          <div>
            <Image src="/brand/loran-wordmark-burgundy.png" alt="لوران" width={110} height={28} className="h-6 w-auto" />
            <p className="mt-1 text-xs text-[#5f564e]">{siteConfig.legalName}</p>
            <p className="text-xs text-[#5f564e]">{siteConfig.domain}</p>
          </div>
        </div>
        <div className="text-end">
          <h1 className="text-lg font-bold">فاکتور فروش</h1>
          <p className="tnum mt-1 text-sm" dir="ltr">{order.number}</p>
          <p className="mt-0.5 text-xs text-[#5f564e]">تاریخ صدور: {formatDate(order.createdAt)}</p>
        </div>
      </header>

      <section className="mt-5 grid gap-5 border-b border-[#e4dace] pb-5 text-sm sm:grid-cols-2">
        <div>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#8a8078]">خریدار</h2>
          <p className="font-medium">{order.customerName}</p>
          <p className="tnum mt-1" dir="ltr">{formatPhone(order.customerPhone)}</p>
        </div>
        <div>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#8a8078]">نشانی تحویل</h2>
          <p className="leading-7">
            {order.address.recipientFirstName} {order.address.recipientLastName}
            <br />
            {order.address.province}، {order.address.city}، {order.address.addressLine}
            {order.address.plaque && `، پلاک ${order.address.plaque}`}
            {order.address.unit && `، واحد ${order.address.unit}`}
          </p>
          <p className="tnum mt-1">کد پستی: {toPersianDigits(order.address.postalCode)}</p>
        </div>
      </section>

      <section className="mt-5">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-[#211d1a]">
              <th scope="col" className="w-8 py-2 text-start font-bold">#</th>
              <th scope="col" className="py-2 text-start font-bold">شرح کالا</th>
              <th scope="col" className="py-2 text-start font-bold">مشخصات</th>
              <th scope="col" className="w-16 py-2 text-center font-bold">تعداد</th>
              <th scope="col" className="w-28 py-2 text-end font-bold">قیمت واحد</th>
              <th scope="col" className="w-28 py-2 text-end font-bold">مبلغ کل</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, i) => (
              <tr key={`${item.variantId}-${i}`} className="border-b border-[#e4dace] align-top">
                <td className="tnum py-3">{toPersianDigits(i + 1)}</td>
                <td className="py-3 pe-2">{item.name}</td>
                <td className="tnum py-3 pe-2 text-[#5f564e]">
                  {item.colorName}، سایز {toPersianDigits(item.size)}
                </td>
                <td className="tnum py-3 text-center">{toPersianDigits(item.quantity)}</td>
                <td className="tnum py-3 text-end">{formatAmount(item.unitPrice)}</td>
                <td className="tnum py-3 text-end font-medium">
                  {formatAmount(item.unitPrice * item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Totals. No VAT line: this is not a tax document. */}
      <section className="print-keep mt-5 flex justify-end">
        <dl className="w-full max-w-xs space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-[#5f564e]">جمع کالاها</dt>
            <dd className="tnum">{formatAmount(itemsTotal)}</dd>
          </div>
          {order.totals.productDiscount > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-[#5f564e]">تخفیف محصولات</dt>
              <dd className="tnum">− {formatAmount(order.totals.productDiscount)}</dd>
            </div>
          )}
          {order.totals.couponDiscount > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-[#5f564e]">
                کد تخفیف{order.couponCode ? ` (${order.couponCode})` : ""}
              </dt>
              <dd className="tnum">− {formatAmount(order.totals.couponDiscount)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt className="text-[#5f564e]">هزینه ارسال</dt>
            <dd className="tnum">
              {order.shippingPaidOnDelivery
                ? "پس‌کرایه"
                : formatAmount(order.totals.shippingCost)}
            </dd>
          </div>
          <div className="flex justify-between gap-3 border-t-2 border-[#211d1a] pt-2 text-base font-bold">
            <dt>مبلغ پرداخت‌شده</dt>
            <dd className="tnum">{formatAmount(order.totals.payableOnline)} تومان</dd>
          </div>
        </dl>
      </section>

      <section className="print-keep mt-5 grid gap-4 border-t border-[#e4dace] pt-5 text-xs sm:grid-cols-2">
        <div>
          <h3 className="mb-1.5 font-bold">اطلاعات پرداخت</h3>
          <p className="text-[#5f564e]">
            روش: {PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}
          </p>
          <p className="text-[#5f564e]">
            وضعیت: {order.paymentStatus === "paid" ? "پرداخت شده" : "پرداخت نشده"}
          </p>
          {order.paymentRef && (
            <p className="tnum text-[#5f564e]" dir="ltr">کد پیگیری: {order.paymentRef}</p>
          )}
          {order.paidAt && <p className="text-[#5f564e]">تاریخ: {formatDate(order.paidAt)}</p>}
        </div>
        <div>
          <h3 className="mb-1.5 font-bold">اطلاعات ارسال</h3>
          <p className="text-[#5f564e]">{order.shippingMethodName}</p>
          {order.trackingCode && (
            <p className="tnum text-[#5f564e]" dir="ltr">
              کد رهگیری: {order.trackingCode}
            </p>
          )}
          {order.shippingPaidOnDelivery && (
            <p className="mt-1 font-medium">
              کرایه ارسال هنگام تحویل، نزد مأمور {order.carrier ?? order.shippingMethodName} پرداخت می‌شود.
            </p>
          )}
        </div>
      </section>

      <footer className="mt-6 border-t border-[#e4dace] pt-4 text-center text-xs text-[#8a8078]">
        <p>از خرید شما سپاسگزاریم. {siteConfig.contact.workingHours}</p>
        <p className="tnum mt-1" dir="ltr">{siteConfig.contact.supportPhoneRaw}</p>
      </footer>
    </article>
  );
}
