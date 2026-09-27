"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card, DataTable } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Overlay";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Alert, EmptyState } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { useAction } from "@/lib/use-action";
import { formatAmount, formatDate, toPersianDigits } from "@/lib/format";

/**
 * Coupons and campaigns.
 *
 * Both are only *configured* here. What a coupon is worth on a given cart is
 * decided by the server at checkout, and a campaign's effect on a price by the
 * pricing rules — this screen sets the rules, it never computes a discount.
 *
 * `usageCount` is derived from real redemptions and is deliberately read-only.
 */

export interface CouponRow {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  maxDiscount: number | null;
  minSubtotal: number | null;
  description: string;
  active: boolean;
  archived: boolean;
  expired: boolean;
  startsAt?: string;
  expiresAt?: string;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  usageCount: number;
  totalDiscount: number;
}

export interface CampaignRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  type: "percent" | "fixed";
  value: number;
  maxDiscount: number | null;
  active: boolean;
  priority: number;
  startsAt?: string;
  endsAt?: string;
  state: string;
  productCount: number;
  products: { id: string; name: string; slug: string }[];
}

const CAMPAIGN_STATE = {
  active: { tone: "success" as const, label: "فعال" },
  scheduled: { tone: "info" as const, label: "زمان‌بندی‌شده" },
  ended: { tone: "neutral" as const, label: "پایان‌یافته" },
  inactive: { tone: "neutral" as const, label: "غیرفعال" },
};

/** Percent or fixed, rendered the same way everywhere. */
function discountLabel(type: "percent" | "fixed", value: number, maxDiscount: number | null) {
  if (type === "percent") {
    return maxDiscount
      ? `${toPersianDigits(value)}٪ تا سقف ${formatAmount(maxDiscount)}`
      : `${toPersianDigits(value)}٪`;
  }
  return `${formatAmount(value)} تومان`;
}

/* -------------------------------------------------------------------------- */
/* Coupons                                                                     */
/* -------------------------------------------------------------------------- */

export function CouponManager({ coupons }: { coupons: CouponRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<CouponRow | null>(null);
  const [creating, setCreating] = useState(false);

  const remove = useAction(
    async (id: string) =>
      api.delete<{ action: string; message: string }>(`/api/v1/admin/coupons/${id}`),
    {
      onSuccess: (result) => {
        toast({
          tone: result.action === "deleted" ? "success" : "info",
          title: result.action === "deleted" ? "کد تخفیف حذف شد" : "کد تخفیف بایگانی شد",
          description: result.message,
        });
        router.refresh();
      },
      onError: (message) => toast({ tone: "error", title: "حذف انجام نشد", description: message }),
    }
  );

  const toggle = useAction(
    async ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/api/v1/admin/coupons/${id}`, { active }),
    {
      onSuccess: () => {
        toast({ tone: "success", title: "وضعیت کد تخفیف تغییر کرد" });
        router.refresh();
      },
    }
  );

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="font-bold text-fg">کدهای تخفیف</h2>
          <p className="mt-1 text-xs text-fg-muted">
            اعتبار و مبلغ تخفیف هنگام پرداخت روی سرور محاسبه می‌شود.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)} icon={<Plus className="size-4" aria-hidden />}>
          کد تخفیف جدید
        </Button>
      </div>

      <DataTable<CouponRow>
        rows={coupons}
        getKey={(c) => c.id}
        empty={<EmptyState className="border-0" title="هنوز کد تخفیفی تعریف نشده است" />}
        renderCard={(coupon) => (
          <div className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="tnum font-bold text-fg" dir="ltr">{coupon.code}</p>
              <CouponStatus coupon={coupon} />
            </div>
            <p className="mt-1 text-xs text-fg-muted">{coupon.description}</p>
            <p className="tnum mt-2 text-sm text-fg">
              {discountLabel(coupon.type, coupon.value, coupon.maxDiscount)}
            </p>
            <p className="tnum mt-1 text-xs text-fg-subtle">
              {toPersianDigits(coupon.usageCount)} بار استفاده شده
            </p>
          </div>
        )}
        columns={[
          {
            key: "code",
            header: "کد",
            cell: (coupon) => (
              <div>
                <p className="tnum font-bold text-fg" dir="ltr">{coupon.code}</p>
                <p className="line-clamp-1 text-xs text-fg-muted">{coupon.description}</p>
              </div>
            ),
          },
          {
            key: "value",
            header: "تخفیف",
            cell: (coupon) => (
              <span className="tnum text-fg">
                {discountLabel(coupon.type, coupon.value, coupon.maxDiscount)}
              </span>
            ),
          },
          {
            key: "min",
            header: "حداقل خرید",
            hideOn: "md",
            cell: (coupon) => (
              <span className="tnum text-fg-muted">
                {coupon.minSubtotal ? formatAmount(coupon.minSubtotal) : "—"}
              </span>
            ),
          },
          {
            key: "usage",
            header: "استفاده",
            align: "center",
            cell: (coupon) => (
              <span className="tnum text-fg-muted">
                {toPersianDigits(coupon.usageCount)}
                {coupon.usageLimit ? ` / ${toPersianDigits(coupon.usageLimit)}` : ""}
              </span>
            ),
          },
          {
            key: "expiry",
            header: "انقضا",
            hideOn: "md",
            cell: (coupon) => (
              <span className="text-fg-muted">
                {coupon.expiresAt ? formatDate(coupon.expiresAt) : "بدون محدودیت"}
              </span>
            ),
          },
          { key: "status", header: "وضعیت", cell: (coupon) => <CouponStatus coupon={coupon} /> },
          {
            key: "actions",
            header: "عملیات",
            align: "end",
            cell: (coupon) => (
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  onClick={() => void toggle.run({ id: coupon.id, active: !coupon.active })}
                  disabled={toggle.pending || coupon.archived}
                  className="h-9 rounded-md border border-border px-2.5 text-xs text-fg-muted hover:text-fg disabled:opacity-50"
                >
                  {coupon.active ? "غیرفعال" : "فعال"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(coupon)}
                  aria-label={`ویرایش ${coupon.code}`}
                  className="grid size-9 place-items-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-fg"
                >
                  <Pencil className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const message =
                      coupon.usageCount > 0
                        ? `کد «${coupon.code}» ${toPersianDigits(coupon.usageCount)} بار در سفارش‌ها استفاده شده و به‌جای حذف، بایگانی می‌شود. ادامه می‌دهید؟`
                        : `کد تخفیف «${coupon.code}» حذف شود؟`;
                    if (confirm(message)) void remove.run(coupon.id);
                  }}
                  disabled={remove.pending}
                  aria-label={`حذف ${coupon.code}`}
                  className="grid size-9 place-items-center rounded-md text-fg-subtle hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            ),
          },
        ]}
      />

      <CouponModal
        open={creating || editing !== null}
        coupon={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onDone={() => { setCreating(false); setEditing(null); router.refresh(); }}
      />
    </Card>
  );
}

function CouponStatus({ coupon }: { coupon: CouponRow }) {
  if (coupon.archived) return <Badge tone="neutral" size="sm">بایگانی</Badge>;
  if (coupon.expired) return <Badge tone="warning" size="sm">منقضی</Badge>;
  if (!coupon.active) return <Badge tone="neutral" size="sm">غیرفعال</Badge>;
  return <Badge tone="success" size="sm">فعال</Badge>;
}

function CouponModal({
  open, coupon, onClose, onDone,
}: {
  open: boolean;
  coupon: CouponRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [seeded, setSeeded] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "", type: "percent" as "percent" | "fixed", value: "", maxDiscount: "",
    minSubtotal: "", description: "", active: true, startsAt: "", expiresAt: "",
    usageLimit: "", perCustomerLimit: "",
  });

  const key = coupon?.id ?? "new";
  if (open && seeded !== key) {
    setSeeded(key);
    setForm({
      code: coupon?.code ?? "",
      type: coupon?.type ?? "percent",
      value: coupon ? String(coupon.value) : "",
      maxDiscount: coupon?.maxDiscount ? String(coupon.maxDiscount) : "",
      minSubtotal: coupon?.minSubtotal ? String(coupon.minSubtotal) : "",
      description: coupon?.description ?? "",
      active: coupon?.active ?? true,
      startsAt: coupon?.startsAt?.slice(0, 10) ?? "",
      expiresAt: coupon?.expiresAt?.slice(0, 10) ?? "",
      usageLimit: coupon?.usageLimit ? String(coupon.usageLimit) : "",
      perCustomerLimit: coupon?.perCustomerLimit ? String(coupon.perCustomerLimit) : "",
    });
  }

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const num = (value: string) => (value ? Number(value) : null);

  const save = useAction(
    async () => {
      const payload = {
        code: form.code.trim().toUpperCase(),
        type: form.type,
        value: Number(form.value),
        maxDiscount: form.type === "percent" ? num(form.maxDiscount) : null,
        minSubtotal: num(form.minSubtotal),
        description: form.description.trim(),
        active: form.active,
        startsAt: form.startsAt || null,
        expiresAt: form.expiresAt || null,
        usageLimit: num(form.usageLimit),
        perCustomerLimit: num(form.perCustomerLimit),
      };
      return coupon
        ? api.patch(`/api/v1/admin/coupons/${coupon.id}`, payload)
        : api.post("/api/v1/admin/coupons", payload);
    },
    {
      onSuccess: () => {
        toast({ tone: "success", title: coupon ? "کد تخفیف ویرایش شد" : "کد تخفیف ایجاد شد" });
        onDone();
      },
    }
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={coupon ? "ویرایش کد تخفیف" : "کد تخفیف جدید"}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={save.pending}>انصراف</Button>
          <Button type="submit" form="coupon-form" loading={save.pending} disabled={save.pending}>
            ذخیره
          </Button>
        </div>
      }
    >
      <form
        id="coupon-form"
        noValidate
        className="space-y-4"
        aria-busy={save.pending}
        onSubmit={(e) => { e.preventDefault(); void save.run(); }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="کد"
            required
            dir="ltr"
            className="[&_input]:text-start [&_input]:uppercase"
            value={form.code}
            onChange={(e) => set("code", e.target.value)}
            placeholder="LORAN10"
            disabled={save.pending}
          />
          <Select
            label="نوع تخفیف"
            value={form.type}
            onChange={(e) => set("type", e.target.value)}
            options={[
              { value: "percent", label: "درصدی" },
              { value: "fixed", label: "مبلغ ثابت" },
            ]}
            disabled={save.pending}
          />
          <Input
            label={form.type === "percent" ? "درصد تخفیف" : "مبلغ تخفیف (تومان)"}
            required
            dir="ltr"
            inputMode="numeric"
            className="[&_input]:text-start"
            value={form.value}
            onChange={(e) => set("value", e.target.value.replace(/\D/g, ""))}
            disabled={save.pending}
          />
          {form.type === "percent" && (
            <Input
              label="سقف تخفیف (تومان)"
              dir="ltr"
              inputMode="numeric"
              className="[&_input]:text-start"
              value={form.maxDiscount}
              onChange={(e) => set("maxDiscount", e.target.value.replace(/\D/g, ""))}
              hint="خالی = بدون سقف"
              disabled={save.pending}
            />
          )}
          <Input
            label="حداقل مبلغ سبد (تومان)"
            dir="ltr"
            inputMode="numeric"
            className="[&_input]:text-start"
            value={form.minSubtotal}
            onChange={(e) => set("minSubtotal", e.target.value.replace(/\D/g, ""))}
            disabled={save.pending}
          />
          <Input
            label="سقف کل استفاده"
            dir="ltr"
            inputMode="numeric"
            className="[&_input]:text-start"
            value={form.usageLimit}
            onChange={(e) => set("usageLimit", e.target.value.replace(/\D/g, ""))}
            hint="خالی = نامحدود"
            disabled={save.pending}
          />
          <Input
            label="سقف استفاده هر مشتری"
            dir="ltr"
            inputMode="numeric"
            className="[&_input]:text-start"
            value={form.perCustomerLimit}
            onChange={(e) => set("perCustomerLimit", e.target.value.replace(/\D/g, ""))}
            hint="خالی = نامحدود"
            disabled={save.pending}
          />
          <Input
            label="تاریخ شروع"
            type="date"
            dir="ltr"
            className="[&_input]:text-start"
            value={form.startsAt}
            onChange={(e) => set("startsAt", e.target.value)}
            disabled={save.pending}
          />
          <Input
            label="تاریخ انقضا"
            type="date"
            dir="ltr"
            className="[&_input]:text-start"
            value={form.expiresAt}
            onChange={(e) => set("expiresAt", e.target.value)}
            disabled={save.pending}
          />
        </div>

        <Textarea
          label="توضیح (برای نمایش به مشتری)"
          rows={2}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          disabled={save.pending}
        />

        <Checkbox
          label="فعال"
          checked={form.active}
          onChange={(e) => set("active", e.target.checked)}
          disabled={save.pending}
        />

        {coupon && coupon.usageCount > 0 && (
          <Alert tone="info">
            این کد {toPersianDigits(coupon.usageCount)} بار استفاده شده و مجموع{" "}
            {formatAmount(coupon.totalDiscount)} تومان تخفیف داده است. شمارنده استفاده از روی
            سفارش‌های واقعی محاسبه می‌شود و قابل ویرایش نیست.
          </Alert>
        )}

        {save.error && <Alert tone="danger" role="alert">{save.error}</Alert>}
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Campaigns                                                                   */
/* -------------------------------------------------------------------------- */

export function CampaignManager({
  campaigns,
  products,
}: {
  campaigns: CampaignRow[];
  products: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<CampaignRow | null>(null);
  const [creating, setCreating] = useState(false);

  const remove = useAction(
    async (id: string) => api.delete<{ message: string }>(`/api/v1/admin/campaigns/${id}`),
    {
      onSuccess: (result) => {
        toast({ tone: "success", title: "کمپین حذف شد", description: result.message });
        router.refresh();
      },
      onError: (message) => toast({ tone: "error", title: "حذف انجام نشد", description: message }),
    }
  );

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="font-bold text-fg">کمپین‌ها</h2>
          <p className="mt-1 text-xs text-fg-muted">
            تخفیف کمپین روی قیمت محصولات انتخاب‌شده اعمال می‌شود؛ هم در فروشگاه و هم هنگام پرداخت.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)} icon={<Plus className="size-4" aria-hidden />}>
          کمپین جدید
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState className="border-0" title="هنوز کمپینی تعریف نشده است" />
      ) : (
        <ul className="divide-y divide-border">
          {campaigns.map((campaign) => {
            const state = CAMPAIGN_STATE[campaign.state as keyof typeof CAMPAIGN_STATE];
            return (
              <li key={campaign.id} className="flex flex-wrap items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-fg">
                    {campaign.name}
                    <Badge tone={state?.tone ?? "neutral"} size="sm">{state?.label}</Badge>
                  </p>
                  <p className="tnum mt-1 text-sm text-fg-muted">
                    {discountLabel(campaign.type, campaign.value, campaign.maxDiscount)} روی{" "}
                    {toPersianDigits(campaign.productCount)} محصول
                  </p>
                  <p className="mt-1 text-xs text-fg-subtle">
                    {campaign.startsAt ? formatDate(campaign.startsAt) : "بدون تاریخ شروع"} —{" "}
                    {campaign.endsAt ? formatDate(campaign.endsAt) : "بدون تاریخ پایان"}
                    {campaign.priority > 0 && ` — اولویت ${toPersianDigits(campaign.priority)}`}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(campaign)}
                    aria-label={`ویرایش ${campaign.name}`}
                    className="grid size-9 place-items-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-fg"
                  >
                    <Pencil className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`کمپین «${campaign.name}» حذف شود؟ قیمت سفارش‌های گذشته تغییر نمی‌کند.`)) {
                        void remove.run(campaign.id);
                      }
                    }}
                    disabled={remove.pending}
                    aria-label={`حذف ${campaign.name}`}
                    className="grid size-9 place-items-center rounded-md text-fg-subtle hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <CampaignModal
        open={creating || editing !== null}
        campaign={editing}
        products={products}
        onClose={() => { setCreating(false); setEditing(null); }}
        onDone={() => { setCreating(false); setEditing(null); router.refresh(); }}
      />
    </Card>
  );
}

function CampaignModal({
  open, campaign, products, onClose, onDone,
}: {
  open: boolean;
  campaign: CampaignRow | null;
  products: { id: string; name: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [seeded, setSeeded] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", type: "percent" as "percent" | "fixed", value: "", maxDiscount: "",
    description: "", active: true, startsAt: "", endsAt: "", priority: "0",
  });
  const [productIds, setProductIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const key = campaign?.id ?? "new";
  if (open && seeded !== key) {
    setSeeded(key);
    setForm({
      name: campaign?.name ?? "",
      type: campaign?.type ?? "percent",
      value: campaign ? String(campaign.value) : "",
      maxDiscount: campaign?.maxDiscount ? String(campaign.maxDiscount) : "",
      description: campaign?.description ?? "",
      active: campaign?.active ?? true,
      startsAt: campaign?.startsAt?.slice(0, 10) ?? "",
      endsAt: campaign?.endsAt?.slice(0, 10) ?? "",
      priority: String(campaign?.priority ?? 0),
    });
    setProductIds(campaign?.products.map((p) => p.id) ?? []);
    setSearch("");
  }

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const filtered = search.trim()
    ? products.filter((p) => p.name.includes(search.trim()))
    : products.slice(0, 40);

  const save = useAction(
    async () => {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        value: Number(form.value),
        maxDiscount: form.type === "percent" && form.maxDiscount ? Number(form.maxDiscount) : null,
        description: form.description.trim(),
        active: form.active,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        priority: Number(form.priority) || 0,
        productIds,
      };
      return campaign
        ? api.patch(`/api/v1/admin/campaigns/${campaign.id}`, payload)
        : api.post("/api/v1/admin/campaigns", payload);
    },
    {
      onSuccess: () => {
        toast({ tone: "success", title: campaign ? "کمپین ویرایش شد" : "کمپین ایجاد شد" });
        onDone();
      },
    }
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={campaign ? "ویرایش کمپین" : "کمپین جدید"}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={save.pending}>انصراف</Button>
          <Button type="submit" form="campaign-form" loading={save.pending} disabled={save.pending}>
            ذخیره
          </Button>
        </div>
      }
    >
      <form
        id="campaign-form"
        noValidate
        className="space-y-4"
        aria-busy={save.pending}
        onSubmit={(e) => { e.preventDefault(); void save.run(); }}
      >
        <Input
          label="نام کمپین"
          required
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="حراج پایان فصل"
          disabled={save.pending}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="نوع تخفیف"
            value={form.type}
            onChange={(e) => set("type", e.target.value)}
            options={[
              { value: "percent", label: "درصدی" },
              { value: "fixed", label: "مبلغ ثابت" },
            ]}
            disabled={save.pending}
          />
          <Input
            label={form.type === "percent" ? "درصد تخفیف" : "مبلغ تخفیف (تومان)"}
            required
            dir="ltr"
            inputMode="numeric"
            className="[&_input]:text-start"
            value={form.value}
            onChange={(e) => set("value", e.target.value.replace(/\D/g, ""))}
            disabled={save.pending}
          />
          <Input
            label="تاریخ شروع"
            type="date"
            dir="ltr"
            className="[&_input]:text-start"
            value={form.startsAt}
            onChange={(e) => set("startsAt", e.target.value)}
            disabled={save.pending}
          />
          <Input
            label="تاریخ پایان"
            type="date"
            dir="ltr"
            className="[&_input]:text-start"
            value={form.endsAt}
            onChange={(e) => set("endsAt", e.target.value)}
            disabled={save.pending}
          />
          <Input
            label="اولویت"
            dir="ltr"
            inputMode="numeric"
            className="[&_input]:text-start"
            value={form.priority}
            onChange={(e) => set("priority", e.target.value.replace(/\D/g, ""))}
            hint="اگر محصولی در چند کمپین باشد، بالاترین اولویت اعمال می‌شود."
            disabled={save.pending}
          />
        </div>

        <Checkbox
          label="فعال"
          checked={form.active}
          onChange={(e) => set("active", e.target.checked)}
          disabled={save.pending}
        />

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-fg">
            محصولات کمپین ({toPersianDigits(productIds.length)} انتخاب‌شده)
          </legend>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جست‌وجوی محصول"
            aria-label="جست‌وجوی محصول"
            disabled={save.pending}
            className="mb-2 h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-sm
                       focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
          <div className="max-h-60 overflow-y-auto rounded-md border border-border p-2">
            {filtered.map((product) => (
              <Checkbox
                key={product.id}
                label={product.name}
                checked={productIds.includes(product.id)}
                onChange={(e) =>
                  setProductIds((current) =>
                    e.target.checked
                      ? [...current, product.id]
                      : current.filter((id) => id !== product.id)
                  )
                }
                disabled={save.pending}
              />
            ))}
            {filtered.length === 0 && (
              <p className="p-3 text-center text-sm text-fg-muted">محصولی پیدا نشد.</p>
            )}
          </div>
        </fieldset>

        {save.error && <Alert tone="danger" role="alert">{save.error}</Alert>}
      </form>
    </Modal>
  );
}
