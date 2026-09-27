"use client";

import { useState } from "react";
import { Instagram, Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/Navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { useAction } from "@/lib/use-action";
import { siteConfig } from "@/lib/site-config";
import { isValidPhone } from "@/lib/format";

const SUBJECTS = [
  { value: "order", label: "پیگیری سفارش" },
  { value: "product", label: "سؤال درباره محصول" },
  { value: "return", label: "مرجوعی و تعویض" },
  { value: "cooperation", label: "همکاری و عمده‌فروشی" },
  { value: "other", label: "موضوع دیگر" },
];

export default function ContactPage() {
  const { toast } = useToast();
  const [values, setValues] = useState({ name: "", phone: "", subject: "order", message: "" });

  /**
   * Persists the message.
   *
   * The subject is sent as its human label rather than its key, so the
   * administrator's queue reads as a sentence instead of a slug.
   */
  const send = useAction(
    async () =>
      api.post<{ number: string; message: string }>("/api/v1/contact", {
        fullName: values.name.trim(),
        phone: values.phone.trim(),
        subject: SUBJECTS.find((s) => s.value === values.subject)?.label ?? values.subject,
        message: values.message.trim(),
      }),
    {
      onSuccess: (result) => {
        setSent(true);
        toast({ tone: "success", title: "پیام شما ارسال شد", description: result.message });
      },
      onError: (message) =>
        toast({ tone: "error", title: "ارسال پیام انجام نشد", description: message }),
    }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  const set = (key: keyof typeof values, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!values.name.trim()) next.name = "نام خود را وارد کنید.";
    if (!isValidPhone(values.phone)) next.phone = "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.";
    if (values.message.trim().length < 10) next.message = "پیام باید دست‌کم ۱۰ حرف باشد.";
    setErrors(next);
    if (Object.keys(next).length) {
      document.getElementById(`contact-${Object.keys(next)[0]}`)?.focus();
      return;
    }
    void send.run();
  };

  const whatsappNumber = siteConfig.contact.whatsapp.replace(/[^\d]/g, "");

  return (
    <div className="container-page py-6 lg:py-8">
      <Breadcrumbs className="mb-5" items={[{ label: "خانه", href: "/" }, { label: "تماس با ما" }]} />

      <header className="max-w-2xl">
        <h1 className="text-2xl font-bold text-fg sm:text-3xl">تماس با لوران</h1>
        <p className="mt-3 text-sm leading-8 text-fg-muted">
          سؤالی درباره سایز، سفارش یا مرجوعی دارید؟ از هر راهی که راحت‌ترید با ما در تماس باشید.
        </p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:gap-8">
        {/* Channels */}
        <div className="space-y-4">
          <Card>
            <h2 className="mb-4 font-bold text-fg">راه‌های ارتباطی</h2>
            <ul className="space-y-4">
              <li className="flex gap-3">
                <Phone className="mt-0.5 size-5 shrink-0 text-fg-subtle" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-fg">تلفن پشتیبانی</p>
                  <a href={`tel:${siteConfig.contact.supportPhoneRaw}`} className="tnum inline-flex min-h-8 items-center text-sm text-fg-muted hover:text-primary dark:hover:text-[color:var(--primary-soft-fg)]" dir="ltr">
                    {siteConfig.contact.supportPhone}
                  </a>
                  <p className="text-xs text-fg-subtle">{siteConfig.contact.workingHours}</p>
                </div>
              </li>
              <li className="flex gap-3">
                <MessageCircle className="mt-0.5 size-5 shrink-0 text-fg-subtle" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-fg">واتس‌اپ</p>
                  <a
                    href={`https://wa.me/${whatsappNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-8 items-center text-sm text-fg-muted hover:text-primary dark:hover:text-[color:var(--primary-soft-fg)]"
                  >
                    گفت‌وگوی مستقیم با پشتیبانی
                  </a>
                </div>
              </li>
              <li className="flex gap-3">
                <Mail className="mt-0.5 size-5 shrink-0 text-fg-subtle" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-fg">ایمیل</p>
                  <a href={`mailto:${siteConfig.contact.email}`} className="inline-flex min-h-8 items-center text-sm text-fg-muted hover:text-primary dark:hover:text-[color:var(--primary-soft-fg)]" dir="ltr">
                    {siteConfig.contact.email}
                  </a>
                </div>
              </li>
              <li className="flex gap-3">
                <Instagram className="mt-0.5 size-5 shrink-0 text-fg-subtle" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-fg">اینستاگرام</p>
                  <div className="flex flex-wrap gap-x-3">
                    {siteConfig.social.filter((s) => s.id.startsWith("instagram") && s.url).map((s) => (
                      <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex min-h-8 items-center text-sm text-fg-muted hover:text-primary dark:hover:text-[color:var(--primary-soft-fg)]" dir="ltr">
                        {s.handle}
                      </a>
                    ))}
                  </div>
                </div>
              </li>
            </ul>

            <Alert tone="info" className="mt-5">
              اطلاعات تماس بالا موقت است و پیش از انتشار نهایی سایت با مقادیر رسمی جایگزین می‌شود.
            </Alert>
          </Card>
        </div>

        {/* Form */}
        <Card>
          <h2 className="mb-1 font-bold text-fg">فرم تماس</h2>
          <p className="mb-5 text-sm text-fg-muted">پیامتان را بنویسید؛ طی یک روز کاری پاسخ می‌دهیم.</p>

          {sent ? (
            <Alert tone="success" title="پیام شما دریافت شد">
              کارشناسان لوران به‌زودی با شما تماس می‌گیرند.
              <div className="mt-3">
                <Button variant="secondary" size="sm" onClick={() => { setSent(false); setValues({ name: "", phone: "", subject: "order", message: "" }); }}>
                  ارسال پیام دیگر
                </Button>
              </div>
            </Alert>
          ) : (
            <form onSubmit={submit} noValidate className="space-y-4">
              <Input
                id="contact-name"
                label="نام و نام خانوادگی"
                required
                autoComplete="name"
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
                error={errors.name}
              />
              <Input
                id="contact-phone"
                label="شماره موبایل"
                required
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                dir="ltr"
                className="[&_input]:text-start"
                placeholder="09123456789"
                value={values.phone}
                onChange={(e) => set("phone", e.target.value)}
                error={errors.phone}
              />
              <Select
                id="contact-subject"
                label="موضوع"
                value={values.subject}
                onChange={(e) => set("subject", e.target.value)}
                options={SUBJECTS}
              />
              <Textarea
                id="contact-message"
                label="پیام شما"
                required
                rows={5}
                value={values.message}
                onChange={(e) => set("message", e.target.value)}
                error={errors.message}
                placeholder="سؤال یا درخواستتان را بنویسید…"
              />
              <Button
                type="submit"
                loading={send.pending}
                disabled={send.pending}
                icon={<Send className="size-4" aria-hidden />}
              >
                ارسال پیام
              </Button>
            </form>
          )}
        </Card>
      </div>

      {/* Stores + map */}
      <section id="stores" className="mt-12 scroll-mt-24" aria-labelledby="stores-title">
        <h2 id="stores-title" className="text-xl font-bold text-fg sm:text-2xl">شعبه‌های حضوری</h2>
        <p className="mt-2 text-sm leading-7 text-fg-muted">
          هر سه شعبه در پاساژ ستاره یزد قرار دارند.
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <ul className="space-y-3">
            {siteConfig.stores.map((store) => (
              <li key={store.id}>
                <Card>
                  <h3 className="flex items-start gap-2 font-semibold text-fg">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-hidden />
                    {store.name}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-fg-muted">{store.address}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={`tel:${store.phone}`}
                      className="tnum inline-flex h-10 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-fg-muted hover:text-fg"
                      dir="ltr"
                    >
                      <Phone className="size-3.5" aria-hidden />
                      {store.phone}
                    </a>
                    {/* Enabled once the real map link is added to site-config.ts */}
                    <button
                      type="button"
                      disabled={!store.mapsUrl}
                      aria-disabled={!store.mapsUrl}
                      title={store.mapsUrl ? "مسیریابی" : "لینک مسیریابی هنوز ثبت نشده است"}
                      className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-fg-muted disabled:opacity-50"
                    >
                      <MapPin className="size-3.5" aria-hidden />
                      مسیریابی
                    </button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          {/* Map placeholder — swap for the embed once coordinates are final. */}
          <div className="relative min-h-72 overflow-hidden rounded-lg border border-border bg-surface-2">
            <div aria-hidden className="brand-grid absolute inset-0 opacity-60" />
            <div className="relative grid h-full place-items-center p-8 text-center">
              <div>
                <MapPin className="mx-auto size-10 text-fg-subtle" aria-hidden />
                <p className="mt-3 font-semibold text-fg">نقشه شعبه‌ها</p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-7 text-fg-muted">
                  نقشه و مسیریابی پس از ثبت مختصات دقیق شعبه‌ها در این بخش نمایش داده می‌شود.
                  محل قرارگیری نقشه و دکمه‌های مسیریابی از همین حالا رزرو شده است.
                </p>
                <p className="mt-3 text-xs text-fg-subtle">
                  برای فعال‌سازی، مقدار <code dir="ltr" className="rounded bg-surface px-1">mapsUrl</code> و{" "}
                  <code dir="ltr" className="rounded bg-surface px-1">coords</code> را در{" "}
                  <code dir="ltr" className="rounded bg-surface px-1">site-config.ts</code> پر کنید.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
