"use client";

import { useState } from "react";
import { Heart, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Button, ButtonLink, IconButton } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Checkbox, RadioCard, Switch } from "@/components/ui/Checkbox";
import { Badge, Chip, DiscountBadge, FilterChip } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Alert, EmptyState, ProductCardSkeleton, Skeleton, Spinner } from "@/components/ui/Feedback";
import { Accordion, Breadcrumbs, Pagination, Stepper, Tabs } from "@/components/ui/Navigation";
import { BottomSheet, Drawer, Modal } from "@/components/ui/Overlay";
import { Price, PriceInline } from "@/components/ui/Price";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { RatingSummary, StarPicker, Stars } from "@/components/ui/Rating";
import { useToast } from "@/components/ui/Toast";
import { ThemeSegmented } from "@/components/layout/ThemeToggle";
import { ProductCard } from "@/components/product/ProductCard";
import type { ProductSummary } from "@/types";

/**
 * Living design system.
 *
 * Every element below is the real component the storefront uses, not a copy —
 * so this page cannot drift from the product. It is the reference for anyone
 * extending the UI.
 */

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="scroll-mt-20 border-t border-border py-8 first:border-0 first:pt-0">
      <h2 className="text-lg font-bold text-fg">{title}</h2>
      {description && <p className="mt-1.5 max-w-2xl text-sm leading-7 text-fg-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border py-3 last:border-0">
      <span className="w-32 shrink-0 text-xs text-fg-subtle">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

const TOKENS = {
  spacing: [
    ["۴px", "0.25rem"], ["۸px", "0.5rem"], ["۱۲px", "0.75rem"], ["۱۶px", "1rem"],
    ["۲۴px", "1.5rem"], ["۳۲px", "2rem"], ["۴۸px", "3rem"], ["۶۴px", "4rem"],
  ],
  radius: [
    ["xs — ۶px", "var(--radius-xs)"], ["sm — ۸px", "var(--radius-sm)"],
    ["md — ۱۲px", "var(--radius-md)"], ["lg — ۱۶px", "var(--radius-lg)"],
    ["xl — ۲۰px", "var(--radius-xl)"], ["2xl — ۲۸px", "var(--radius-2xl)"],
  ],
};

const COLOR_GROUPS: { title: string; tokens: { name: string; varName: string; note?: string }[] }[] = [
  {
    title: "سطح‌ها",
    tokens: [
      { name: "canvas", varName: "--canvas", note: "پس‌زمینه صفحه" },
      { name: "surface", varName: "--surface", note: "کارت‌ها و فیلدها" },
      { name: "surface-2", varName: "--surface-2", note: "بلوک‌های فرعی" },
      { name: "surface-3", varName: "--surface-3", note: "بلوک کرم برند" },
    ],
  },
  {
    title: "متن",
    tokens: [
      { name: "fg", varName: "--fg", note: "۱۵٫۹:۱" },
      { name: "fg-muted", varName: "--fg-muted", note: "۶٫۸:۱" },
      { name: "fg-subtle", varName: "--fg-subtle", note: "متن فرعی" },
    ],
  },
  {
    title: "برند",
    tokens: [
      { name: "primary", varName: "--primary", note: "#9A1C21" },
      { name: "primary-hover", varName: "--primary-hover" },
      { name: "primary-soft", varName: "--primary-soft" },
      { name: "border", varName: "--border" },
    ],
  },
  {
    title: "وضعیت",
    tokens: [
      { name: "success", varName: "--success" },
      { name: "warning", varName: "--warning" },
      { name: "danger", varName: "--danger" },
      { name: "info", varName: "--info" },
    ],
  },
];

export function DesignSystemGallery({ sample }: { sample: ProductSummary }) {
  const { toast } = useToast();
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [tab, setTab] = useState("a");
  const [qty, setQty] = useState(2);
  const [rating, setRating] = useState(4);
  const [checked, setChecked] = useState(true);
  const [radio, setRadio] = useState("one");
  const [switched, setSwitched] = useState(true);
  const [page, setPage] = useState(3);

  // A real product from the database, supplied by the server page — the guide
  // shows the card as customers actually see it.

  return (
    <>
      <AdminPageHeader
        title="راهنمای طراحی لوران"
        description="همه اجزای رابط کاربری فروشگاه، از همان کامپوننت‌هایی که در سایت استفاده می‌شوند."
      />

      <Card>
        <Section title="رنگ‌ها" description="رنگ‌ها به‌صورت توکن معنایی تعریف شده‌اند؛ هیچ کامپوننتی کد رنگ خام ندارد. همه ترکیب‌های متن/پس‌زمینه دست‌کم ۴٫۵:۱ کنتراست دارند و در هر دو حالت روشن و تیره بررسی شده‌اند.">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {COLOR_GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="mb-2 text-xs font-semibold text-fg-subtle">{group.title}</h3>
                <ul className="space-y-1.5">
                  {group.tokens.map((token) => (
                    <li key={token.name} className="flex items-center gap-2.5">
                      <span
                        aria-hidden
                        className="size-8 shrink-0 rounded-md border border-border"
                        style={{ background: `var(${token.varName})` }}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium text-fg" dir="ltr">{token.name}</span>
                        {token.note && <span className="block truncate text-[0.6875rem] text-fg-subtle">{token.note}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <h3 className="mb-2 text-xs font-semibold text-fg-subtle">حالت نمایش</h3>
            <ThemeSegmented />
          </div>
        </Section>

        <Section title="تایپوگرافی" description="فونت وزیرمتن با ارتفاع خط ۱٫۷۵ برای متن فارسی. اعداد در جدول‌ها و قیمت‌ها tabular هستند تا ستون‌ها نلرزند.">
          <div className="space-y-3">
            <p className="text-3xl font-bold text-fg">تیتر بزرگ — ۳۰px / Bold</p>
            <p className="text-2xl font-bold text-fg">تیتر صفحه — ۲۴px / Bold</p>
            <p className="text-xl font-bold text-fg">تیتر بخش — ۲۰px / Bold</p>
            <p className="text-base font-semibold text-fg">تیتر کارت — ۱۶px / Semibold</p>
            <p className="text-base leading-8 text-fg-muted">متن اصلی — ۱۶px با ارتفاع خط ۱٫۷۵ برای خوانایی فارسی.</p>
            <p className="text-sm leading-7 text-fg-muted">متن فرعی — ۱۴px</p>
            <p className="text-xs text-fg-subtle">متن توضیحی — ۱۲px</p>
            <p className="tnum text-sm text-fg">اعداد جدولی: ۱٬۲۳۴٬۵۶۷ تومان</p>
          </div>
        </Section>

        <Section title="فاصله‌گذاری و گردی گوشه‌ها" description="مقیاس ۴ واحدی برای فاصله‌ها و شش پله گردی که در کل سایت یکسان است.">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="mb-3 text-xs font-semibold text-fg-subtle">فاصله</h3>
              <div className="space-y-2">
                {TOKENS.spacing.map(([label, value]) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="tnum w-14 shrink-0 text-xs text-fg-subtle">{label}</span>
                    <span className="h-3 rounded-sm bg-primary" style={{ width: value }} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-xs font-semibold text-fg-subtle">گردی گوشه</h3>
              <div className="flex flex-wrap gap-3">
                {TOKENS.radius.map(([label, value]) => (
                  <div key={label} className="text-center">
                    <span className="block size-16 border-2 border-primary bg-primary-soft" style={{ borderRadius: value }} />
                    <span className="mt-1 block text-[0.6875rem] text-fg-subtle">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section title="دکمه‌ها" description="فقط یک دکمه «اصلی» در هر ناحیه از صفحه؛ بقیه کم‌رنگ‌ترند تا رنگ برند معنا داشته باشد. ارتفاع حداقل ۴۴px.">
          <Row label="انواع">
            <Button>اصلی</Button>
            <Button variant="secondary">ثانویه</Button>
            <Button variant="subtle">ملایم</Button>
            <Button variant="ghost">بدون قاب</Button>
            <Button variant="danger">حذف</Button>
            <Button variant="link">لینکی</Button>
          </Row>
          <Row label="اندازه">
            <Button size="sm">کوچک</Button>
            <Button size="md">متوسط</Button>
            <Button size="lg">بزرگ</Button>
          </Row>
          <Row label="حالت‌ها">
            <Button icon={<ShoppingBag className="size-4" aria-hidden />}>با آیکون</Button>
            <Button loading>در حال ارسال</Button>
            <Button disabled>غیرفعال</Button>
            <IconButton label="افزودن به علاقه‌مندی‌ها"><Heart className="size-5" /></IconButton>
            <ButtonLink href="/admin/design-system" variant="secondary">لینک دکمه‌ای</ButtonLink>
          </Row>
        </Section>

        <Section title="فیلدهای فرم" description="هر فیلد برچسب دیدنی دارد (نه فقط placeholder)، و خطا زیر همان فیلد و متصل با aria-describedby نمایش داده می‌شود.">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Input label="نام و نام خانوادگی" placeholder="مثلاً نیما رضوانی" />
            <Input label="شماره موبایل" required dir="ltr" className="[&_input]:text-start" placeholder="09123456789" hint="با ۰۹ شروع شود." />
            <Input label="کد پستی" error="کد پستی باید ۱۰ رقم باشد." defaultValue="۱۲۳" />
            <Select label="استان" placeholder="انتخاب کنید" options={[{ value: "yazd", label: "یزد" }, { value: "tehran", label: "تهران" }]} />
            <Input label="فیلد غیرفعال" disabled defaultValue="غیرقابل ویرایش" />
            <Textarea label="توضیحات" rows={3} placeholder="متن خود را بنویسید…" />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <Checkbox label="فقط کالاهای موجود" count={48} checked={checked} onChange={(e) => setChecked(e.target.checked)} />
              <Checkbox label="گزینه غیرفعال" disabled />
              <Switch checked={switched} onChange={setSwitched} label="پیامک وضعیت سفارش" description="با هر تغییر وضعیت پیامک ارسال می‌شود." />
            </div>
            <div className="space-y-2">
              <RadioCard name="ds" value="one" checked={radio === "one"} onChange={setRadio} title="تیپاکس (پس‌کرایه)" description="هزینه هنگام تحویل پرداخت می‌شود." badge={<Badge tone="warning" size="sm">پس‌کرایه</Badge>} />
              <RadioCard name="ds" value="two" checked={false} disabled onChange={() => {}} title="اسنپ‌پی" description="هنوز فعال نشده است." badge={<Badge tone="neutral" size="sm">به‌زودی</Badge>} />
            </div>
          </div>
        </Section>

        <Section title="نشان‌ها، چیپ‌ها و فیلترها">
          <Row label="نشان وضعیت">
            <Badge>خنثی</Badge>
            <Badge tone="brand">برند</Badge>
            <Badge tone="success">موجود</Badge>
            <Badge tone="warning">در انتظار</Badge>
            <Badge tone="danger">ناموجود</Badge>
            <Badge tone="info">ارسال شد</Badge>
            <DiscountBadge percent={35} />
          </Row>
          <Row label="چیپ انتخابی">
            <Chip selected>انتخاب‌شده</Chip>
            <Chip>انتخاب‌نشده</Chip>
            <Chip disabled>غیرفعال</Chip>
          </Row>
          <Row label="فیلتر فعال">
            <FilterChip label="سایز ۴۲" onRemove={() => toast({ tone: "info", title: "فیلتر حذف شد" })} />
            <FilterChip label="رنگ مشکی" onRemove={() => toast({ tone: "info", title: "فیلتر حذف شد" })} />
          </Row>
          <Row label="امتیاز">
            <Stars value={4.5} />
            <RatingSummary value={4.4} count={128} />
            <StarPicker value={rating} onChange={setRating} />
          </Row>
          <Row label="قیمت">
            <Price value={1_850_000} compareAt={2_600_000} />
            <PriceInline value={1_850_000} />
          </Row>
          <Row label="تعداد">
            <QuantityStepper value={qty} max={5} onChange={setQty} onRemove={() => setQty(1)} />
          </Row>
        </Section>

        <Section title="ناوبری">
          <div className="space-y-6">
            <Breadcrumbs items={[{ label: "خانه", href: "/" }, { label: "فروشگاه", href: "/shop" }, { label: "کتانی و اسنیکر" }]} />
            <Tabs value={tab} onChange={setTab} tabs={[{ value: "a", label: "همه", count: 12 }, { value: "b", label: "جاری", count: 3 }, { value: "c", label: "تحویل‌شده" }]} />
            <Stepper steps={["آدرس تحویل", "ارسال و پرداخت", "بررسی نهایی"]} current={1} />
            <Pagination page={page} totalPages={8} onPageChange={setPage} />
            <Accordion
              defaultOpen="one"
              items={[
                { id: "one", title: "بخش اول", content: "محتوای بخش اول در حالت باز." },
                { id: "two", title: "بخش دوم", content: "محتوای بخش دوم." },
              ]}
            />
          </div>
        </Section>

        <Section title="پیام‌ها و حالت‌ها">
          <div className="grid gap-3 xl:grid-cols-2">
            <Alert tone="info" title="اطلاع‌رسانی">متن توضیحی برای کاربر.</Alert>
            <Alert tone="success" title="انجام شد">عملیات با موفقیت ثبت شد.</Alert>
            <Alert tone="warning" title="هشدار">کرایه ارسال هنگام تحویل دریافت می‌شود.</Alert>
            <Alert tone="danger" title="خطا">پرداخت انجام نشد.</Alert>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => toast({ tone: "success", title: "به سبد خرید اضافه شد", description: "کتانی مشکی، سایز ۴۲" })}>نمایش توست موفق</Button>
            <Button variant="secondary" onClick={() => toast({ tone: "error", title: "کد تخفیف نامعتبر است" })}>نمایش توست خطا</Button>
            <Button variant="secondary" onClick={() => toast({ tone: "info", title: "کالا حذف شد", action: { label: "بازگردانی", onClick: () => {} } })}>توست با بازگردانی</Button>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <EmptyState
              icon={<ShoppingBag className="size-7" aria-hidden />}
              title="حالت خالی"
              description="هر حالت خالی یک اقدام پیشنهادی دارد و بن‌بست نیست."
              action={<Button size="sm">اقدام پیشنهادی</Button>}
            />
            <div>
              <p className="mb-2 text-xs font-semibold text-fg-subtle">اسکلتون بارگذاری</p>
              <div className="grid grid-cols-2 gap-3">
                <ProductCardSkeleton />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-11 w-full" />
                  <span className="inline-flex items-center gap-2 text-sm text-fg-muted">
                    <Spinner className="size-4" /> در حال بارگذاری
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section title="لایه‌های شناور" description="همه این لایه‌ها فوکوس را داخل خود نگه می‌دارند، با Escape بسته می‌شوند و فوکوس را به عنصر فراخوان برمی‌گردانند.">
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setModal(true)}>باز کردن مودال</Button>
            <Button variant="secondary" onClick={() => setDrawer(true)}>باز کردن کشو</Button>
            <Button variant="secondary" onClick={() => setSheet(true)}>باز کردن شیت پایین</Button>
          </div>
        </Section>

        <Section title="کارت محصول" description="کارت اصلی فروشگاه. هیچ اطلاعات ضروری‌ای وابسته به hover نیست.">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <ProductCard product={sample} />
            <ProductCard product={{ ...sample, tags: ["new"], compareAtPrice: undefined, discountPercent: 0 }} />
            <ProductCard product={{ ...sample, inStock: false, variants: sample.variants.map((v) => ({ ...v, stock: 0 })) }} />
            <ProductCardSkeleton />
          </div>
        </Section>
      </Card>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="عنوان مودال"
        description="توضیح کوتاه درباره کاری که قرار است انجام شود."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModal(false)}>انصراف</Button>
            <Button variant="danger" icon={<Trash2 className="size-4" aria-hidden />}>تأیید حذف</Button>
          </div>
        }
      >
        <p className="text-sm leading-7 text-fg-muted">
          مودال برای تأیید و فرم‌های کوتاه استفاده می‌شود، نه برای ناوبری.
        </p>
      </Modal>

      <Drawer open={drawer} onClose={() => setDrawer(false)} side="end" title="کشو کناری"
        footer={<Button fullWidth onClick={() => setDrawer(false)}>بستن</Button>}>
        <div className="p-4 text-sm leading-7 text-fg-muted">
          کشو از لبه صفحه باز می‌شود؛ در چیدمان راست‌به‌چپ، لبه «start» سمت راست است.
        </div>
      </Drawer>

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="شیت پایین"
        description="الگوی موبایل برای فیلترها و انتخاب‌ها."
        footer={<Button fullWidth onClick={() => setSheet(false)}>اعمال</Button>}>
        <div className="space-y-2">
          <Checkbox label="گزینه اول" defaultChecked />
          <Checkbox label="گزینه دوم" />
          <Button variant="secondary" fullWidth icon={<Plus className="size-4" aria-hidden />}>افزودن گزینه</Button>
        </div>
      </BottomSheet>
    </>
  );
}
