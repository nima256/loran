import type { Metadata } from "next";
import Link from "next/link";
import { ContentList, ContentPage, ContentSection } from "@/components/ui/Prose";
import { siteConfig } from "@/lib/site-config";
import { toPersianDigits } from "@/lib/format";

export const metadata: Metadata = {
  title: "قوانین و مقررات",
  description: "شرایط استفاده از فروشگاه اینترنتی لوران.",
};

export default function TermsPage() {
  return (
    <ContentPage
      title="قوانین و مقررات"
      breadcrumb="قوانین و مقررات"
      draft
      lead={`استفاده از فروشگاه اینترنتی ${siteConfig.domain} به معنای پذیرش شرایط زیر است.`}
    >
      <ContentSection title="۱. کلیات" id="general">
        <p>
          این شرایط، رابطه میان خریدار و فروشگاه لوران را در خریدهای اینترنتی مشخص می‌کند. لوران
          می‌تواند این شرایط را به‌روزرسانی کند؛ نسخه معتبر همواره نسخه‌ای است که در این صفحه
          منتشر شده است.
        </p>
      </ContentSection>

      <ContentSection title="۲. ثبت‌نام و حساب کاربری" id="account">
        <ContentList
          items={[
            "برای ثبت سفارش، ورود با شماره موبایل و تأیید کد پیامکی الزامی است.",
            "مسئولیت صحت اطلاعات واردشده (نام گیرنده، نشانی، کد پستی) بر عهده خریدار است.",
            "حفاظت از دسترسی به شماره موبایل و کد تأیید بر عهده کاربر است.",
          ]}
        />
      </ContentSection>

      <ContentSection title="۳. قیمت‌ها و پرداخت" id="pricing">
        <ContentList
          items={[
            "تمام قیمت‌ها به تومان و شامل مالیات بر ارزش افزوده اعلام می‌شوند.",
            "قیمت‌ها ممکن است تغییر کنند؛ مبنای محاسبه، قیمت لحظه ثبت سفارش است.",
            "پرداخت از طریق درگاه بانکی و کارت‌های عضو شتاب انجام می‌شود.",
            "کرایه ارسال با تیپاکس به‌صورت پس‌کرایه و هنگام تحویل دریافت می‌شود و جزو مبلغ پرداخت آنلاین نیست.",
          ]}
        />
      </ContentSection>

      <ContentSection title="۴. موجودی و تأیید سفارش" id="stock">
        <p>
          موجودی هر سایز و رنگ به‌صورت جداگانه نگهداری می‌شود. در موارد نادر که پس از ثبت سفارش
          مشخص شود کالا موجود نیست، سفارش لغو و مبلغ پرداخت‌شده بازگردانده می‌شود.
        </p>
      </ContentSection>

      <ContentSection title="۵. ارسال" id="shipping">
        <p>
          جزئیات کامل در صفحه{" "}
          <Link href="/shipping" className="text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]">
            شیوه‌های ارسال
          </Link>{" "}
          آمده است. زمان‌های اعلام‌شده تخمینی‌اند و تأخیرهای ناشی از شرکت حمل‌ونقل خارج از کنترل
          لوران است.
        </p>
      </ContentSection>

      <ContentSection title="۶. مرجوعی و تعویض" id="returns">
        <p>
          مهلت مرجوعی {toPersianDigits(siteConfig.commerce.returnWindowDays)} روز از تاریخ تحویل است.
          شرایط کامل در صفحه{" "}
          <Link href="/returns" className="text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]">
            مرجوعی و تعویض
          </Link>{" "}
          توضیح داده شده است.
        </p>
      </ContentSection>

      <ContentSection title="۷. دیدگاه کاربران" id="reviews">
        <ContentList
          items={[
            "دیدگاه‌ها به حساب کاربری ثبت‌شده متصل می‌شوند.",
            "لوران می‌تواند دیدگاه‌های حاوی توهین، تبلیغ یا اطلاعات نادرست را منتشر نکند.",
            "امتیاز و متن دیدگاه پس از بررسی منتشر می‌شود.",
          ]}
        />
      </ContentSection>

      <ContentSection title="۸. مالکیت محتوا" id="ip">
        <p>
          نشان تجاری، تصاویر و محتوای این سایت متعلق به لوران است و بازنشر تجاری آن‌ها بدون اجازه
          کتبی مجاز نیست.
        </p>
      </ContentSection>

      <p className="mt-6 text-xs text-fg-subtle">
        آخرین به‌روزرسانی: متن نمونه — تاریخ نهایی پس از تأیید حقوقی درج می‌شود.
      </p>
    </ContentPage>
  );
}
