import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/ui/Prose";
import { Accordion } from "@/components/ui/Navigation";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { siteConfig } from "@/lib/site-config";
import { formatAmount, toPersianDigits } from "@/lib/format";

export const metadata: Metadata = {
  title: "پرسش‌های پرتکرار",
  description: "پاسخ سؤال‌های رایج درباره سایز، ارسال، پرداخت و مرجوعی در فروشگاه لوران.",
};

const GROUPS = [
  {
    title: "سفارش و پرداخت",
    items: [
      {
        id: "q-account",
        title: "برای خرید حتماً باید ثبت‌نام کنم؟",
        content: "بله. برای ثبت سفارش، ورود با شماره موبایل و تأیید کد پیامکی لازم است. این کار باعث می‌شود بتوانید سفارشتان را پیگیری کنید و در صورت نیاز درخواست مرجوعی ثبت کنید.",
      },
      {
        id: "q-payment",
        title: "چه روش‌هایی برای پرداخت وجود دارد؟",
        content: "در حال حاضر پرداخت اینترنتی با کارت‌های عضو شتاب فعال است. روش‌های اعتباری مانند اسنپ‌پی و ترب‌پی در حال آماده‌سازی هستند و پس از فعال‌سازی در صفحه پرداخت نمایش داده می‌شوند.",
      },
      {
        id: "q-coupon",
        title: "کد تخفیف را کجا وارد کنم؟",
        content: "در صفحه سبد خرید یا در دو مرحله اول تکمیل خرید، فیلد «کد تخفیف» را پر کنید. پس از اعمال، مبلغ تخفیف بلافاصله در خلاصه سفارش نمایش داده می‌شود.",
      },
      {
        id: "q-invoice",
        title: "فاکتور سفارشم را از کجا بگیرم؟",
        content: "از بخش «سفارش‌ها» در حساب کاربری، روی «فاکتور» کلیک کنید. فاکتور قابل چاپ است و می‌توانید آن را به‌صورت PDF ذخیره کنید.",
      },
    ],
  },
  {
    title: "سایز و محصول",
    items: [
      {
        id: "q-size",
        title: "چطور سایز درست را انتخاب کنم؟",
        content: "در صفحه هر محصول، «راهنمای سایز» را باز کنید و طول پایتان را با جدول مقایسه کنید. اگر بین دو سایز مردد بودید، سایز بزرگ‌تر را انتخاب کنید یا درخواست مشاوره بدهید.",
      },
      {
        id: "q-stock",
        title: "چرا بعضی سایزها خط‌خورده‌اند؟",
        content: "موجودی هر کفش به‌تفکیک رنگ و سایز نگهداری می‌شود. سایز خط‌خورده یعنی آن سایز در رنگ انتخابی شما موجود نیست؛ ممکن است در رنگ دیگری موجود باشد.",
      },
      {
        id: "q-original",
        title: "کالاها اصل هستند؟",
        content: "همان کالایی که در شعبه‌های حضوری لوران در پاساژ ستاره یزد عرضه می‌شود، در فروشگاه اینترنتی هم فروخته می‌شود.",
      },
    ],
  },
  {
    title: "ارسال و تحویل",
    items: [
      {
        id: "q-shipping-cost",
        title: "هزینه ارسال چقدر است و کی پرداخت می‌شود؟",
        content: "ارسال با تیپاکس و به‌صورت پس‌کرایه است؛ یعنی کرایه را هنگام تحویل مرسوله به مأمور تیپاکس می‌پردازید. مبلغی که در سایت پرداخت می‌کنید فقط بابت کالاهاست.",
      },
      {
        id: "q-free-shipping",
        title: "ارسال رایگان شامل چه سفارش‌هایی می‌شود؟",
        content: `سفارش‌های بالای ${formatAmount(siteConfig.commerce.freeShippingThreshold)} تومان مشمول ارسال رایگان هستند و کرایه آن‌ها را لوران پرداخت می‌کند.`,
      },
      {
        id: "q-delivery-time",
        title: "سفارشم چند روزه می‌رسد؟",
        content: "آماده‌سازی سفارش معمولاً یک روز کاری طول می‌کشد و تحویل با تیپاکس بسته به شهر مقصد، ۲ تا ۴ روز کاری زمان می‌برد.",
      },
      {
        id: "q-tracking",
        title: "کد رهگیری مرسوله را از کجا ببینم؟",
        content: "پس از تحویل سفارش به تیپاکس، کد رهگیری در صفحه جزئیات سفارش نمایش داده می‌شود و در صورت فعال بودن پیامک، برایتان ارسال می‌شود.",
      },
    ],
  },
  {
    title: "مرجوعی و پشتیبانی",
    items: [
      {
        id: "q-return",
        title: "اگر سایز مناسب نبود چه کار کنم؟",
        content: `تا ${toPersianDigits(siteConfig.commerce.returnWindowDays)} روز پس از تحویل، از بخش «مرجوعی و تعویض» در حساب کاربری درخواست تعویض سایز ثبت کنید. کفش باید استفاده‌نشده و با جعبه اصلی باشد.`,
      },
      {
        id: "q-refund",
        title: "بازگشت وجه چقدر طول می‌کشد؟",
        content: "پس از دریافت و تأیید کالای مرجوعی، مبلغ حداکثر تا ۷۲ ساعت کاری به همان کارت پرداخت‌کننده بازگردانده می‌شود.",
      },
      {
        id: "q-support",
        title: "چطور با پشتیبانی تماس بگیرم؟",
        content: `از طریق تلفن ${siteConfig.contact.supportPhone}، واتس‌اپ یا فرم تماس در صفحه «تماس با ما». ساعت پاسخ‌گویی: ${siteConfig.contact.workingHours}`,
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <ContentPage
      title="پرسش‌های پرتکرار"
      breadcrumb="پرسش‌های پرتکرار"
      lead="پاسخ سؤال‌هایی که بیشتر از همه از ما پرسیده می‌شود."
      aside={
        <Card className="bg-surface-2">
          <h2 className="font-bold text-fg">پاسختان را پیدا نکردید؟</h2>
          <p className="mt-2 text-sm leading-7 text-fg-muted">
            سؤالتان را بپرسید؛ طی یک روز کاری پاسخ می‌دهیم.
          </p>
          <ButtonLink href="/contact" className="mt-4" fullWidth>تماس با پشتیبانی</ButtonLink>
          <Link href="/consultation" className="mt-3 inline-flex min-h-9 w-full items-center justify-center text-sm text-fg-muted hover:text-fg">
            درخواست مشاوره سایز
          </Link>
        </Card>
      }
    >
      <div className="space-y-8">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h2 className="mb-3 text-lg font-bold text-fg">{group.title}</h2>
            <Accordion items={group.items} defaultOpen={group.items[0].id} />
          </section>
        ))}
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: GROUPS.flatMap((g) =>
              g.items.map((item) => ({
                "@type": "Question",
                name: item.title,
                acceptedAnswer: { "@type": "Answer", text: item.content },
              }))
            ),
          }),
        }}
      />
    </ContentPage>
  );
}
