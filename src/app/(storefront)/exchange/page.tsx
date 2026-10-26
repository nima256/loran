import type { Metadata } from "next";
import Link from "next/link";
import { ContentList, ContentPage, ContentSection } from "@/components/ui/Prose";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { toPersianDigits } from "@/lib/format";
import { EXCHANGE_WINDOW_LABEL } from "@/lib/exchange-policy";

export const metadata: Metadata = {
  title: "شرایط تعویض کالا",
  description: `در فروشگاه لوران فقط امکان تعویض کالا وجود دارد؛ تا ${EXCHANGE_WINDOW_LABEL} پس از تحویل سفارش.`,
};

/**
 * The exchange policy. Loran is exchange-only: no returns, no refunds. The
 * window comes from `lib/exchange-policy`, the same rule the server enforces.
 * The old `/returns` address redirects here (next.config.ts).
 */
export default function ExchangePolicyPage() {
  return (
    <ContentPage
      title="شرایط تعویض کالا"
      breadcrumb="شرایط تعویض"
      draft
      lead={`اگر سایز یا مدل کفشی که سفارش داده‌اید مناسب نبود، تا ${EXCHANGE_WINDOW_LABEL} پس از تحویل سفارش می‌توانید درخواست تعویض ثبت کنید. در لوران امکان مرجوع کردن کالا و بازگشت وجه وجود ندارد؛ فقط تعویض انجام می‌شود.`}
      aside={
        <Card className="bg-surface-2">
          <h2 className="font-bold text-fg">ثبت درخواست تعویض</h2>
          <p className="mt-2 text-sm leading-7 text-fg-muted">
            درخواست تعویض را مستقیماً از حساب کاربری‌تان و حداکثر تا {EXCHANGE_WINDOW_LABEL} پس از
            تحویل ثبت کنید.
          </p>
          <ButtonLink href="/account/exchanges" className="mt-4" fullWidth>
            ثبت درخواست تعویض
          </ButtonLink>
          <Link href="/contact" className="mt-3 inline-flex min-h-9 w-full items-center justify-center text-sm text-fg-muted hover:text-fg">
            یا با پشتیبانی تماس بگیرید
          </Link>
        </Card>
      }
    >
      <Alert tone="warning" title="فقط تعویض، بدون بازگشت وجه">
        خرید از لوران قابل مرجوع کردن و بازگشت وجه نیست. اگر کالا مناسب نبود، می‌توانید آن را با
        سایز، رنگ یا مدل دیگری تعویض کنید.
      </Alert>

      <ContentSection title="مهلت تعویض: ۲ روز کاری">
        <p>
          درخواست تعویض باید حداکثر تا {EXCHANGE_WINDOW_LABEL} پس از تاریخ تحویل سفارش ثبت شود.
          روزهای کاری شنبه تا پنجشنبه است و جمعه حساب نمی‌شود. روز تحویل، روز صفر است؛ برای مثال
          سفارشی که چهارشنبه تحویل شده، تا پایان شنبه قابل درخواست تعویض است.
        </p>
      </ContentSection>

      <ContentSection title="در چه شرایطی کالا تعویض می‌شود؟">
        <ContentList
          items={[
            "کالا استفاده نشده باشد و کف آن اثر پوشیدن در بیرون از خانه نداشته باشد.",
            "جعبه، برچسب‌ها و ملحقات کفش کامل و سالم باشند.",
            `درخواست حداکثر تا ${EXCHANGE_WINDOW_LABEL} پس از تاریخ تحویل ثبت شود.`,
            "فاکتور یا شماره سفارش در دسترس باشد.",
          ]}
        />
        <Alert tone="info" className="mt-4">
          پرو کردن کفش روی سطح تمیز و داخل منزل مشکلی ایجاد نمی‌کند؛ آنچه پذیرفته نمی‌شود،
          استفاده در بیرون و ساییدگی زیره است.
        </Alert>
      </ContentSection>

      <ContentSection title="مراحل تعویض">
        <ol className="not-prose space-y-3">
          {[
            { title: "ثبت درخواست", body: `از بخش «درخواست‌های تعویض» در حساب کاربری، حداکثر تا ${EXCHANGE_WINDOW_LABEL} پس از تحویل، سفارش، کالا و دلیل را انتخاب کنید.` },
            { title: "تأیید کارشناس", body: "طی یک روز کاری با شما تماس گرفته می‌شود و سایز یا مدل جایگزین هماهنگ می‌شود." },
            { title: "ارسال کالا", body: "کالا را با بسته‌بندی اصلی به نشانی اعلام‌شده ارسال کنید." },
            { title: "ارسال کالای جایگزین", body: "پس از دریافت و بررسی کالا، کالای جایگزین برای شما ارسال می‌شود." },
          ].map((step, i) => (
            <li key={step.title} className="flex gap-3 rounded-lg border border-border bg-surface p-4">
              <span className="tnum grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary-soft-fg">
                {toPersianDigits(i + 1)}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-fg">{step.title}</h3>
                <p className="mt-1 text-sm leading-7 text-fg-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </ContentSection>

      <ContentSection title="تفاوت قیمت و هزینه ارسال">
        <p>
          اگر کالای جایگزین گران‌تر باشد، مابه‌التفاوت را پرداخت می‌کنید. اگر ارزان‌تر باشد، مبلغ
          نقدی بازگردانده نمی‌شود.
        </p>
        <p>
          در صورتی که کالا ایراد تولیدی داشته باشد یا اشتباه ارسال شده باشد، هزینه رفت‌وبرگشت بر
          عهده لوران است. در تعویض سایز یا مدل به درخواست خریدار، هزینه ارسال طبق توافق هنگام ثبت
          درخواست تعیین می‌شود.
        </p>
        <p className="text-fg-subtle">
          (بندهای این بخش نمونه است و باید با شرایط نهایی کسب‌وکار جایگزین شود.)
        </p>
      </ContentSection>

      <ContentSection title="کالاهایی که تعویض نمی‌شوند">
        <ContentList
          items={[
            "کفش‌هایی که در بیرون از منزل استفاده شده‌اند.",
            "کالاهایی که به سفارش مشتری تغییر داده شده‌اند.",
            "کالاهای آسیب‌دیده به‌دلیل نگهداری یا استفاده نادرست.",
            `درخواست‌هایی که پس از ${EXCHANGE_WINDOW_LABEL} از تحویل ثبت شوند.`,
          ]}
        />
      </ContentSection>
    </ContentPage>
  );
}
