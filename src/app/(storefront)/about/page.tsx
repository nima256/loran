import type { Metadata } from "next";
import Image from "next/image";
import { Award, Heart, MapPin, Truck } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Breadcrumbs } from "@/components/ui/Navigation";
import { siteConfig } from "@/lib/site-config";
import { toPersianDigits } from "@/lib/format";

export const metadata: Metadata = {
  title: "درباره لوران",
  description: "داستان فروشگاه کفش لوران در یزد و مسیری که تا فروش اینترنتی طی کرده است.",
};

export default function AboutPage() {
  const values = [
    { icon: Award, title: "انتخاب سخت‌گیرانه", body: "هر مدلی که وارد ویترین می‌شود، اول خودمان می‌پوشیمش. اگر راحت نباشد، نمی‌فروشیمش." },
    { icon: Heart, title: "مشاوره واقعی", body: "به جای فروختن هر چیزی، کمک می‌کنیم سایز و مدل درست را انتخاب کنید — حتی اگر ارزان‌تر باشد." },
    { icon: Truck, title: "ارسال مطمئن", body: "بسته‌بندی محکم و ارسال با تیپاکس به سراسر ایران، با کد رهگیری." },
    { icon: MapPin, title: "حضور واقعی در یزد", body: "سه شعبه حضوری در پاساژ ستاره؛ همان کفشی که آنلاین می‌بینید، آنجا هم هست." },
  ];

  return (
    <div className="container-page py-6 lg:py-8">
      <Breadcrumbs className="mb-5" items={[{ label: "خانه", href: "/" }, { label: "درباره لوران" }]} />

      <header className="max-w-2xl">
        <p className="text-sm font-semibold text-primary dark:text-[color:var(--primary-soft-fg)]">درباره ما</p>
        <h1 className="mt-3 text-2xl font-bold leading-10 text-fg sm:text-3xl">
          لوران از یک ویترین کوچک در پاساژ ستاره شروع شد
        </h1>
        <p className="mt-4 text-base leading-9 text-fg-muted">
          سال‌هاست در یزد کفش می‌فروشیم. کارمان را با یک غرفه کوچک شروع کردیم و امروز سه شعبه
          حضوری داریم. فروشگاه اینترنتی لوران ادامه همان کار است: همان کفش‌ها، همان مشاوره،
          فقط این‌بار برای کسانی که دورتر از یزد زندگی می‌کنند.
        </p>
      </header>

      {/* The brand's own artwork, used as the story image. */}
      <div className="mt-8 overflow-hidden rounded-xl border border-border bg-surface-3 dark:bg-surface-2">
        <div className="grid items-center gap-6 p-6 sm:p-8 lg:grid-cols-2 lg:gap-10">
          <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-lg">
            <Image
              src="/brand/loran-social-reference.webp"
              alt="تصویر تبلیغاتی لوران با چند جفت کفش روی جعبه‌های برند"
              fill
              sizes="(min-width: 1024px) 400px, 90vw"
              className="object-cover"
            />
          </div>
          <div>
            <h2 className="text-xl font-bold text-fg">چرا یک فروشگاه کفش، اینترنتی شد؟</h2>
            <p className="mt-4 text-sm leading-8 text-fg-muted">
              هر هفته از شهرهای دیگر تماس می‌گرفتند و می‌پرسیدند «این مدل را می‌فرستید؟». اول با
              پیام و عکس کار را راه می‌انداختیم، اما انتخاب سایز از روی چند عکس، برای هیچ‌کس
              تجربه خوبی نبود.
            </p>
            <p className="mt-3 text-sm leading-8 text-fg-muted">
              فروشگاه اینترنتی لوران را ساختیم تا موجودی هر سایز و هر رنگ شفاف باشد، راهنمای سایز
              در دسترس باشد و بعد از خرید هم بتوانید سفارشتان را قدم‌به‌قدم پیگیری کنید.
            </p>
          </div>
        </div>
      </div>

      <section className="mt-10" aria-labelledby="values">
        <h2 id="values" className="text-xl font-bold text-fg">چیزی که برایمان مهم است</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {values.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3 rounded-lg border border-border bg-surface p-4 sm:p-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary-soft text-primary-soft-fg">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <h3 className="font-semibold text-fg">{title}</h3>
                <p className="mt-1.5 text-sm leading-7 text-fg-muted">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 rounded-xl border border-border bg-surface p-6 sm:p-8" aria-labelledby="stores-summary">
        <h2 id="stores-summary" className="text-xl font-bold text-fg">شعبه‌های حضوری ما</h2>
        <p className="mt-2 text-sm leading-7 text-fg-muted">
          اگر یزد هستید، می‌توانید کفش را از نزدیک ببینید و پرو کنید.
        </p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-3">
          {siteConfig.stores.map((store) => (
            <li key={store.id} className="rounded-lg bg-surface-2 p-4">
              <h3 className="text-sm font-semibold text-fg">{store.name}</h3>
              <p className="mt-1.5 text-xs leading-6 text-fg-muted">{store.address}</p>
              <p className="tnum mt-1 text-xs text-fg-subtle" dir="ltr">{store.phone}</p>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/contact">تماس و نشانی شعبه‌ها</ButtonLink>
          <ButtonLink href="/shop" variant="secondary">دیدن محصولات</ButtonLink>
        </div>
      </section>

      <p className="mt-6 text-xs text-fg-subtle">
        * اطلاعات شعبه‌ها و شماره‌های تماس، موقت است و پیش از انتشار نهایی سایت به‌روزرسانی می‌شود.
        تعداد مدل‌های فعال فروشگاه: {toPersianDigits(100)} عدد.
      </p>
    </div>
  );
}
