"use client";

import { useState } from "react";
import { CheckCircle2, MessageCircle, Ruler, Send } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/Navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Alert } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { useAction } from "@/lib/use-action";
import { isValidPhone, toPersianDigits } from "@/lib/format";
import { siteConfig } from "@/lib/site-config";

const CONTACT_METHODS = [
  { value: "phone", label: "تماس تلفنی" },
  { value: "whatsapp", label: "واتس‌اپ" },
  { value: "sms", label: "پیامک" },
];

export interface ConsultationFormProps {
  categories: { slug: string; name: string }[];
  sizes: number[];
}

export function ConsultationForm({ categories, sizes }: ConsultationFormProps) {
  const { toast } = useToast();
  const [values, setValues] = useState({
    name: "", phone: "", usualSize: "", category: "", footWidth: "normal",
    contactMethod: "whatsapp", note: "",
  });
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  /**
   * Persists the request.
   *
   * The structured answers are sent with their human labels as keys, so the
   * administrator's queue is readable without a lookup table.
   */
  const send = useAction(
    async () => {
      const categoryName = categories.find((c) => c.slug === values.category)?.name;
      const widthLabel = { narrow: "باریک", normal: "معمولی", wide: "پهن" }[
        values.footWidth as "narrow" | "normal" | "wide"
      ];
      const contactLabel = CONTACT_METHODS.find((m) => m.value === values.contactMethod)?.label;

      return api.post<{ number: string; message: string }>("/api/v1/consultations", {
        fullName: values.name.trim(),
        phone: values.phone.trim(),
        message: values.note.trim() || undefined,
        answers: {
          "سایز معمول": values.usualSize,
          ...(categoryName ? { "نوع کفش": categoryName } : {}),
          ...(widthLabel ? { "فرم پا": widthLabel } : {}),
          ...(contactLabel ? { "روش تماس": contactLabel } : {}),
        },
      });
    },
    {
      onSuccess: (result) => {
        setSent(true);
        toast({ tone: "success", title: "درخواست مشاوره ثبت شد", description: result.message });
      },
      onError: (message) =>
        toast({ tone: "error", title: "ثبت درخواست انجام نشد", description: message }),
    }
  );

  const set = (key: keyof typeof values, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!values.name.trim()) next.name = "نام خود را وارد کنید.";
    if (!isValidPhone(values.phone)) next.phone = "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.";
    if (!values.usualSize) next.usualSize = "سایز معمول خود را انتخاب کنید.";
    if (!agree) next.agree = "برای ثبت درخواست، تماس کارشناس را تأیید کنید.";
    setErrors(next);
    if (Object.keys(next).length) {
      document.getElementById(`cons-${Object.keys(next)[0]}`)?.focus();
      return;
    }
    void send.run();
  };

  return (
    <div className="container-page py-6 lg:py-8">
      <Breadcrumbs className="mb-5" items={[{ label: "خانه", href: "/" }, { label: "درخواست مشاوره" }]} />

      <header className="max-w-2xl">
        <h1 className="text-2xl font-bold text-fg sm:text-3xl">درخواست مشاوره سایز و مدل</h1>
        <p className="mt-3 text-base leading-9 text-fg-muted">
          مطمئن نیستید کدام سایز یا مدل مناسب شماست؟ چند سؤال کوتاه را پاسخ دهید؛ کارشناس لوران
          با شما تماس می‌گیرد و انتخاب را ساده‌تر می‌کند. این مشاوره رایگان است.
        </p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:gap-8">
        <Card>
          {sent ? (
            <div className="py-6 text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-success-soft text-success">
                <CheckCircle2 className="size-8" aria-hidden />
              </span>
              <h2 className="mt-4 text-lg font-bold text-fg">درخواست شما ثبت شد</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-7 text-fg-muted">
                کارشناس لوران در ساعات کاری ({siteConfig.contact.workingHours}) با شما تماس می‌گیرد.
              </p>
              <Button
                variant="secondary"
                className="mt-5"
                onClick={() => { setSent(false); setAgree(false); setValues({ name: "", phone: "", usualSize: "", category: "", footWidth: "normal", contactMethod: "whatsapp", note: "" }); }}
              >
                ثبت درخواست دیگر
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  id="cons-name"
                  label="نام و نام خانوادگی"
                  required
                  autoComplete="name"
                  value={values.name}
                  onChange={(e) => set("name", e.target.value)}
                  error={errors.name}
                />
                <Input
                  id="cons-phone"
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
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  id="cons-usualSize"
                  label="سایزی که معمولاً می‌پوشید"
                  required
                  placeholder="انتخاب سایز"
                  value={values.usualSize}
                  onChange={(e) => set("usualSize", e.target.value)}
                  error={errors.usualSize}
                  options={sizes.map((s) => ({ value: String(s), label: toPersianDigits(s) }))}
                />
                <Select
                  id="cons-category"
                  label="چه نوع کفشی می‌خواهید؟"
                  placeholder="اختیاری"
                  value={values.category}
                  onChange={(e) => set("category", e.target.value)}
                  options={categories.map((c) => ({ value: c.slug, label: c.name }))}
                />
              </div>

              <fieldset>
                <legend className="mb-2 text-sm font-medium text-fg">فرم پای شما</legend>
                <div className="grid grid-cols-3 gap-2">
                  {([["narrow", "باریک"], ["normal", "معمولی"], ["wide", "پهن"]] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => set("footWidth", value)}
                      aria-pressed={values.footWidth === value}
                      className={[
                        "flex min-h-12 items-center justify-center rounded-md border px-3 text-sm transition-colors",
                        values.footWidth === value
                          ? "border-primary bg-primary text-primary-fg"
                          : "border-border bg-surface text-fg-muted hover:text-fg",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <Select
                label="ترجیح می‌دهید چطور با شما تماس بگیریم؟"
                value={values.contactMethod}
                onChange={(e) => set("contactMethod", e.target.value)}
                options={CONTACT_METHODS}
              />

              <Textarea
                label="توضیحات"
                rows={4}
                value={values.note}
                onChange={(e) => set("note", e.target.value)}
                hint="اختیاری — مثلاً «کفش راحت برای ۸ ساعت سرپا بودن می‌خواهم»."
                placeholder="هر نکته‌ای که به انتخاب کمک می‌کند…"
              />

              <div>
                <Checkbox
                  id="cons-agree"
                  label="با تماس کارشناس لوران در ساعات کاری موافقم."
                  checked={agree}
                  onChange={(e) => { setAgree(e.target.checked); setErrors((s) => ({ ...s, agree: "" })); }}
                />
                {errors.agree && <p role="alert" className="mt-1 text-sm text-danger">{errors.agree}</p>}
              </div>

              <Button type="submit" loading={send.pending} disabled={send.pending} icon={<Send className="size-4" aria-hidden />}>
                ثبت درخواست مشاوره
              </Button>
            </form>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="bg-surface-2">
            <h2 className="flex items-center gap-2 font-bold text-fg">
              <Ruler className="size-5 text-fg-subtle" aria-hidden />
              قبل از تماس، این را بدانید
            </h2>
            <p className="mt-2 text-sm leading-7 text-fg-muted">
              اگر طول پایتان را اندازه گرفته باشید، مشاوره خیلی دقیق‌تر می‌شود. روش اندازه‌گیری
              در راهنمای سایز توضیح داده شده است.
            </p>
            <a href="/size-guide" className="mt-4 inline-flex h-11 items-center rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-fg hover:bg-surface-3">
              دیدن راهنمای سایز
            </a>
          </Card>

          <Alert tone="brand" title="ترجیح می‌دهید همین الان بپرسید؟">
            <span className="inline-flex items-center gap-1.5">
              <MessageCircle className="size-4" aria-hidden />
              در واتس‌اپ پیام بدهید؛ در ساعات کاری معمولاً سریع پاسخ می‌دهیم.
            </span>
          </Alert>
        </div>
      </div>
    </div>
  );
}
