import type { Metadata } from "next";
import Link from "next/link";
import { ContentList, ContentPage, ContentSection } from "@/components/ui/Prose";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { siteConfig } from "@/lib/site-config";
import { toPersianDigits } from "@/lib/format";

export const metadata: Metadata = {
  title: "مرجوعی و تعویض",
  description: "شرایط و مراحل تعویض سایز یا مرجوع کردن کالا در فروشگاه لوران.",
};

export default function ReturnsPolicyPage() {
  return (
    <ContentPage
      title="مرجوعی و تعویض"
      breadcrumb="مرجوعی و تعویض"
      draft
      lead={`اگر کفشی که سفارش داده‌اید مناسب نبود، تا ${toPersianDigits(siteConfig.commerce.returnWindowDays)} روز پس از تحویل می‌توانید آن را تعویض یا مرجوع کنید.`}
      aside={
        <Card className="bg-surface-2">
          <h2 className="font-bold text-fg">ثبت درخواست</h2>
          <p className="mt-2 text-sm leading-7 text-fg-muted">
            درخواست تعویض یا مرجوعی را مستقیماً از حساب کاربری‌تان ثبت کنید.
          </p>
          <ButtonLink href="/account/returns" className="mt-4" fullWidth>
            ثبت درخواست مرجوعی
          </ButtonLink>
          <Link href="/contact" className="mt-3 inline-flex min-h-9 w-full items-center justify-center text-sm text-fg-muted hover:text-fg">
            یا با پشتیبانی تماس بگیرید
          </Link>
        </Card>
      }
    >
      <ContentSection title="در چه شرایطی کالا پذیرفته می‌شود؟">
        <ContentList
          items={[
            "کالا استفاده نشده باشد و کف آن اثر پوشیدن در بیرون از خانه نداشته باشد.",
            "جعبه، برچسب‌ها و ملحقات کفش کامل و سالم باشند.",
            `درخواست حداکثر تا ${toPersianDigits(siteConfig.commerce.returnWindowDays)} روز پس از تاریخ تحویل ثبت شود.`,
            "فاکتور یا شماره سفارش در دسترس باشد.",
          ]}
        />
        <Alert tone="info" className="mt-4">
          پرو کردن کفش روی سطح تمیز و داخل منزل مشکلی ایجاد نمی‌کند؛ آنچه پذیرفته نمی‌شود،
          استفاده در بیرون و ساییدگی زیره است.
        </Alert>
      </ContentSection>

      <ContentSection title="مراحل تعویض یا مرجوعی">
        <ol className="not-prose space-y-3">
          {[
            { title: "ثبت درخواست", body: "از بخش «مرجوعی و تعویض» در حساب کاربری، سفارش و دلیل را انتخاب کنید." },
            { title: "تأیید کارشناس", body: "طی یک روز کاری با شما تماس گرفته می‌شود و شرایط بررسی می‌شود." },
            { title: "ارسال کالا", body: "کالا را با بسته‌بندی اصلی به نشانی اعلام‌شده ارسال کنید." },
            { title: "بررسی و نتیجه", body: "پس از دریافت و بررسی، کالای جایگزین ارسال یا مبلغ بازگردانده می‌شود." },
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

      <ContentSection title="هزینه ارسال مرجوعی">
        <p>
          در صورتی که کالا ایراد تولیدی داشته باشد یا اشتباه ارسال شده باشد، هزینه رفت‌وبرگشت
          بر عهده لوران است. در تعویض سایز به درخواست خریدار، هزینه ارسال طبق توافق هنگام ثبت
          درخواست تعیین می‌شود.
        </p>
        <p className="text-fg-subtle">
          (این بند نمونه است و باید با شرایط نهایی کسب‌وکار جایگزین شود.)
        </p>
      </ContentSection>

      <ContentSection title="بازگشت وجه">
        <p>
          در صورت تأیید مرجوعی، مبلغ پرداخت‌شده حداکثر تا ۷۲ ساعت کاری پس از دریافت و تأیید کالا،
          به همان کارتی که با آن پرداخت کرده‌اید بازگردانده می‌شود. کرایه‌ای که مستقیماً به تیپاکس
          پرداخت کرده‌اید، جزو مبلغ پرداخت‌شده به لوران نیست.
        </p>
      </ContentSection>

      <ContentSection title="کالاهایی که مرجوع نمی‌شوند">
        <ContentList
          items={[
            "کفش‌هایی که در بیرون از منزل استفاده شده‌اند.",
            "کالاهایی که به سفارش مشتری تغییر داده شده‌اند.",
            "کالاهای آسیب‌دیده به‌دلیل نگهداری یا استفاده نادرست.",
          ]}
        />
      </ContentSection>
    </ContentPage>
  );
}
