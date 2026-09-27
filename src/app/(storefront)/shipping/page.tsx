import type { Metadata } from "next";
import Link from "next/link";
import { Clock, MapPin, PackageCheck, Truck } from "lucide-react";
import { ContentList, ContentPage, ContentSection } from "@/components/ui/Prose";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Feedback";
import { Badge } from "@/components/ui/Badge";
import { listShippingMethods } from "@/server/services/shipping";
import { siteConfig } from "@/lib/site-config";
import { formatAmount, toPersianDigits } from "@/lib/format";

export const metadata: Metadata = {
  title: "شیوه‌های ارسال",
  description: "اطلاعات ارسال سفارش‌های لوران با تیپاکس، زمان تحویل و هزینه کرایه.",
};

/** Rendered on demand so a change in the admin panel shows immediately. */
export const dynamic = "force-dynamic";

export default async function ShippingPage() {
  const shippingMethods = await listShippingMethods();

  return (
    <ContentPage
      title="ارسال و تحویل سفارش"
      breadcrumb="شیوه‌های ارسال"
      lead="سفارش‌های لوران به سراسر ایران ارسال می‌شوند. اینجا می‌خوانید که مرسوله چطور و در چه زمانی به دست شما می‌رسد."
      aside={
        <Card className="bg-surface-2">
          <h2 className="font-bold text-fg">سؤال درباره ارسال؟</h2>
          <p className="mt-2 text-sm leading-7 text-fg-muted">
            اگر مرسوله‌تان دیر رسیده یا کد رهگیری کار نمی‌کند، با پشتیبانی تماس بگیرید.
          </p>
          <Link href="/contact" className="mt-4 inline-flex h-11 items-center rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-fg hover:bg-surface-3">
            تماس با پشتیبانی
          </Link>
        </Card>
      }
    >
      <Alert tone="warning" title="کرایه ارسال هنگام تحویل پرداخت می‌شود">
        شیوه ارسال فعلی لوران <strong>تیپاکس پس‌کرایه</strong> است. مبلغی که در سایت پرداخت
        می‌کنید فقط بابت کالاهاست؛ کرایه مرسوله را هنگام تحویل، مستقیماً به مأمور تیپاکس
        می‌پردازید.
      </Alert>

      <ContentSection title="شیوه‌های ارسال">
        <ul className="not-prose space-y-3">
          {shippingMethods.map((method) => (
            <li key={method.id}>
              <Card className={method.available ? "" : "opacity-70"}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="flex items-center gap-2 font-semibold text-fg">
                    <Truck className="size-4 text-fg-subtle" aria-hidden />
                    {method.name}
                  </h3>
                  {method.available ? (
                    method.paidOnDelivery
                      ? <Badge tone="warning" size="sm">پس‌کرایه</Badge>
                      : <Badge tone="success" size="sm">فعال</Badge>
                  ) : (
                    <Badge tone="neutral" size="sm">به‌زودی</Badge>
                  )}
                </div>
                <p className="mt-2 text-sm leading-7 text-fg-muted">{method.description}</p>
                <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-3 text-xs">
                  <div className="flex gap-1.5">
                    <dt className="text-fg-subtle">زمان تحویل:</dt>
                    <dd className="text-fg">{method.estimate}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-fg-subtle">هزینه:</dt>
                    <dd className="tnum text-fg">
                      {method.paidOnDelivery ? "طبق تعرفه تیپاکس، هنگام تحویل" : `${formatAmount(method.cost)} تومان`}
                    </dd>
                  </div>
                </dl>
              </Card>
            </li>
          ))}
        </ul>
      </ContentSection>

      <ContentSection title="سفارش من چه مسیری را طی می‌کند؟">
        <ol className="not-prose space-y-3">
          {[
            { icon: PackageCheck, title: "ثبت و تأیید سفارش", body: "بلافاصله پس از پرداخت، سفارش در انبار لوران ثبت می‌شود." },
            { icon: Clock, title: "آماده‌سازی و بسته‌بندی", body: "طی یک روز کاری، کالا کنترل کیفی و بسته‌بندی می‌شود." },
            { icon: Truck, title: "تحویل به تیپاکس", body: "کد رهگیری برایتان پیامک می‌شود و در حساب کاربری هم قابل مشاهده است." },
            { icon: MapPin, title: "تحویل به شما", body: "مأمور تیپاکس تماس می‌گیرد؛ کرایه را همان موقع پرداخت می‌کنید." },
          ].map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="flex gap-3 rounded-lg border border-border bg-surface p-4">
              <span className="tnum grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary-soft-fg">
                {toPersianDigits(i + 1)}
              </span>
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
                  <Icon className="size-4 text-fg-subtle" aria-hidden />
                  {title}
                </h3>
                <p className="mt-1 text-sm leading-7 text-fg-muted">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </ContentSection>

      <ContentSection title="نکته‌های مهم">
        <ContentList
          items={[
            `سفارش‌های بالای ${formatAmount(siteConfig.commerce.freeShippingThreshold)} تومان مشمول ارسال رایگان می‌شوند؛ در این حالت کرایه تیپاکس از سوی لوران پرداخت می‌شود.`,
            "سفارش‌های ثبت‌شده در روزهای تعطیل، اولین روز کاری بعد آماده‌سازی می‌شوند.",
            "هنگام تحویل، پیش از پرداخت کرایه، سلامت ظاهری بسته را بررسی کنید.",
            "اگر گیرنده شخص دیگری است، نام و شماره او را در آدرس ثبت کنید.",
            <>
              وضعیت سفارش را می‌توانید از{" "}
              <Link href="/account/orders" className="text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]">
                بخش سفارش‌های حساب کاربری
              </Link>{" "}
              پیگیری کنید.
            </>,
          ]}
        />
      </ContentSection>
    </ContentPage>
  );
}
