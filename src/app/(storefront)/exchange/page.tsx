import type { Metadata } from "next";
import { ContentPage } from "@/components/ui/Prose";
import { Card } from "@/components/ui/Card";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = { title: "شرایط تعویض کالا" };

export default function ExchangePolicyPage() {
  const instagram = siteConfig.social.find((item) => item.id === "instagram")!;
  return (
    <ContentPage title="شرایط تعویض کالا" breadcrumb="تعویض کالا"
      lead="برای هماهنگی تعویض کالا کافی است با پشتیبانی لوران در ارتباط باشید.">
      <Card>
        <h2 className="text-lg font-bold text-fg">درخواست تعویض کالا</h2>
        <p className="mt-3 text-sm leading-8 text-fg-muted">
          برای تعویض کالا، به پیج اینستاگرام لوران دایرکت بدهید یا به ادمین ما پیام ارسال کنید.
          همچنین می‌توانید برای هماهنگی با شماره زیر تماس بگیرید یا پیام بگذارید.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a href={instagram.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-fg">
            دایرکت اینستاگرام {instagram.handle}
          </a>
          <a href={siteConfig.contact.telegramUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-md border border-border px-5 text-sm text-fg">
            پیام به ادمین تلگرام
          </a>
          <a href={`tel:${siteConfig.contact.supportPhoneRaw}`}
            className="inline-flex min-h-11 items-center rounded-md border border-border px-5 text-sm text-fg"
            dir="ltr">{siteConfig.contact.supportPhone}</a>
        </div>
      </Card>
    </ContentPage>
  );
}
