"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Overlay";
import { Input, Textarea } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Alert } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { useAction } from "@/lib/use-action";
import { formatAmount, toPersianDigits } from "@/lib/format";

/**
 * Shipping and payment settings.
 *
 * The boundary this screen exists to respect: **business settings are editable
 * here, gateway credentials are not.** The ZarinPal Merchant ID lives in the
 * server environment; this page reports only whether it is configured, as a
 * boolean, and says where to change it. A credential editable from a browser
 * form is a credential that can be phished out of one — and it would mean the
 * secret travelled to a browser in the first place.
 */

export interface ShippingMethodRow {
  id: string;
  code: string;
  name: string;
  description: string;
  cost: number;
  paidOnDelivery: boolean;
  estimate: string;
  active: boolean;
  position: number;
  freeShippingThreshold: number | null;
  supportsTracking: boolean;
  orderCount: number;
}

export interface PaymentSettingRow {
  id: string;
  code: string;
  name: string;
  description: string;
  active: boolean;
  credentialsConfigured: boolean;
  credentialsHint: string;
  sandbox: boolean;
}

/* -------------------------------------------------------------------------- */
/* Shipping                                                                    */
/* -------------------------------------------------------------------------- */

export function ShippingManager({ methods }: { methods: ShippingMethodRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<ShippingMethodRow | null>(null);
  const [creating, setCreating] = useState(false);

  const toggle = useAction(
    async ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/api/v1/admin/shipping/${id}`, { active }),
    {
      onSuccess: () => {
        toast({ tone: "success", title: "وضعیت روش ارسال تغییر کرد" });
        router.refresh();
      },
      onError: (message) => toast({ tone: "error", title: "تغییر انجام نشد", description: message }),
    }
  );

  const remove = useAction(
    async (id: string) =>
      api.delete<{ action: string; message: string }>(`/api/v1/admin/shipping/${id}`),
    {
      onSuccess: (result) => {
        toast({
          tone: result.action === "deleted" ? "success" : "info",
          title: result.action === "deleted" ? "روش ارسال حذف شد" : "روش ارسال غیرفعال شد",
          description: result.message,
        });
        router.refresh();
      },
      onError: (message) => toast({ tone: "error", title: "حذف انجام نشد", description: message }),
    }
  );

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="font-bold text-fg">روش‌های ارسال</h2>
          <p className="mt-1 text-xs text-fg-muted">
            هزینه و شرایط ارسال هنگام پرداخت روی سرور محاسبه می‌شود.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)} icon={<Plus className="size-4" aria-hidden />}>
          روش ارسال جدید
        </Button>
      </div>

      <ul className="divide-y divide-border">
        {methods.map((method) => (
          <li key={method.id} className="flex flex-wrap items-start gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium text-fg">
                {method.name}
                {method.active
                  ? <Badge tone="success" size="sm">فعال</Badge>
                  : <Badge tone="neutral" size="sm">غیرفعال</Badge>}
                {method.paidOnDelivery && <Badge tone="warning" size="sm">پس‌کرایه</Badge>}
                {method.supportsTracking && <Badge tone="info" size="sm">کد رهگیری</Badge>}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-fg-muted">{method.description}</p>
              <p className="tnum mt-1 text-xs text-fg-subtle">
                <span dir="ltr">{method.code}</span>
                {" — "}
                {method.paidOnDelivery
                  ? "هزینه هنگام تحویل"
                  : `${formatAmount(method.cost)} تومان`}
                {method.freeShippingThreshold != null &&
                  ` — رایگان از ${formatAmount(method.freeShippingThreshold)} تومان`}
                {method.estimate && ` — ${method.estimate}`}
              </p>
              {method.orderCount > 0 && (
                <p className="tnum mt-1 text-xs text-fg-subtle">
                  در {toPersianDigits(method.orderCount)} سفارش استفاده شده
                </p>
              )}
            </div>

            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => void toggle.run({ id: method.id, active: !method.active })}
                disabled={toggle.pending}
                className="h-9 rounded-md border border-border px-2.5 text-xs text-fg-muted hover:text-fg disabled:opacity-50"
              >
                {method.active ? "غیرفعال کردن" : "فعال کردن"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(method)}
                aria-label={`ویرایش ${method.name}`}
                className="grid size-9 place-items-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-fg"
              >
                <Pencil className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => {
                  const message =
                    method.orderCount > 0
                      ? `«${method.name}» در ${toPersianDigits(method.orderCount)} سفارش استفاده شده و به‌جای حذف، غیرفعال می‌شود. ادامه می‌دهید؟`
                      : `روش ارسال «${method.name}» حذف شود؟`;
                  if (confirm(message)) void remove.run(method.id);
                }}
                disabled={remove.pending}
                aria-label={`حذف ${method.name}`}
                className="grid size-9 place-items-center rounded-md text-fg-subtle hover:bg-danger-soft hover:text-danger disabled:opacity-50"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <ShippingModal
        open={creating || editing !== null}
        method={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onDone={() => { setCreating(false); setEditing(null); router.refresh(); }}
      />
    </Card>
  );
}

function ShippingModal({
  open, method, onClose, onDone,
}: {
  open: boolean;
  method: ShippingMethodRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [seeded, setSeeded] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "", name: "", description: "", cost: "0", paidOnDelivery: false,
    estimate: "", active: true, freeShippingThreshold: "", supportsTracking: true,
  });

  const key = method?.id ?? "new";
  if (open && seeded !== key) {
    setSeeded(key);
    setForm({
      code: method?.code ?? "",
      name: method?.name ?? "",
      description: method?.description ?? "",
      cost: String(method?.cost ?? 0),
      paidOnDelivery: method?.paidOnDelivery ?? false,
      estimate: method?.estimate ?? "",
      active: method?.active ?? true,
      freeShippingThreshold: method?.freeShippingThreshold ? String(method.freeShippingThreshold) : "",
      supportsTracking: method?.supportsTracking ?? true,
    });
  }

  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const save = useAction(
    async () => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        cost: Number(form.cost) || 0,
        paidOnDelivery: form.paidOnDelivery,
        estimate: form.estimate.trim(),
        active: form.active,
        freeShippingThreshold: form.freeShippingThreshold
          ? Number(form.freeShippingThreshold)
          : null,
        supportsTracking: form.supportsTracking,
      };
      return method
        ? api.patch(`/api/v1/admin/shipping/${method.id}`, payload)
        : api.post("/api/v1/admin/shipping", { ...payload, code: form.code.trim() || undefined });
    },
    {
      onSuccess: () => {
        toast({ tone: "success", title: method ? "روش ارسال ویرایش شد" : "روش ارسال ایجاد شد" });
        onDone();
      },
    }
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={method ? "ویرایش روش ارسال" : "روش ارسال جدید"}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={save.pending}>انصراف</Button>
          <Button type="submit" form="shipping-form" loading={save.pending} disabled={save.pending}>
            ذخیره
          </Button>
        </div>
      }
    >
      <form
        id="shipping-form"
        noValidate
        className="space-y-4"
        aria-busy={save.pending}
        onSubmit={(e) => { e.preventDefault(); void save.run(); }}
      >
        <Input
          label="نام"
          required
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          disabled={save.pending}
        />

        {!method && (
          <Input
            label="شناسه (code)"
            dir="ltr"
            className="[&_input]:text-start"
            value={form.code}
            onChange={(e) => set("code", e.target.value)}
            hint="خالی بگذارید تا از روی نام ساخته شود. بعد از ایجاد قابل تغییر نیست."
            disabled={save.pending}
          />
        )}

        <Textarea
          label="توضیح (نمایش به مشتری)"
          rows={2}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          disabled={save.pending}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="هزینه ارسال (تومان)"
            dir="ltr"
            inputMode="numeric"
            className="[&_input]:text-start"
            value={form.cost}
            onChange={(e) => set("cost", e.target.value.replace(/\D/g, ""))}
            disabled={save.pending || form.paidOnDelivery}
            hint={form.paidOnDelivery ? "در حالت پس‌کرایه استفاده نمی‌شود." : undefined}
          />
          <Input
            label="سقف ارسال رایگان (تومان)"
            dir="ltr"
            inputMode="numeric"
            className="[&_input]:text-start"
            value={form.freeShippingThreshold}
            onChange={(e) => set("freeShippingThreshold", e.target.value.replace(/\D/g, ""))}
            hint="خالی = بدون ارسال رایگان"
            disabled={save.pending || form.paidOnDelivery}
          />
          <Input
            label="زمان تحویل"
            value={form.estimate}
            onChange={(e) => set("estimate", e.target.value)}
            placeholder="۲ تا ۴ روز کاری"
            disabled={save.pending}
          />
        </div>

        <Checkbox
          label="پس‌کرایه (کرایه را گیرنده هنگام تحویل پرداخت می‌کند)"
          checked={form.paidOnDelivery}
          onChange={(e) => set("paidOnDelivery", e.target.checked)}
          disabled={save.pending}
        />
        <Checkbox
          label="پشتیبانی از کد رهگیری"
          checked={form.supportsTracking}
          onChange={(e) => set("supportsTracking", e.target.checked)}
          disabled={save.pending}
        />
        <Checkbox
          label="فعال"
          checked={form.active}
          onChange={(e) => set("active", e.target.checked)}
          disabled={save.pending}
        />

        {form.paidOnDelivery && (
          <Alert tone="info">
            هزینه پس‌کرایه در مبلغ پرداخت آنلاین محاسبه نمی‌شود و در خلاصه سفارش جداگانه به مشتری
            اعلام می‌شود.
          </Alert>
        )}

        {save.error && <Alert tone="danger" role="alert">{save.error}</Alert>}
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Payment                                                                     */
/* -------------------------------------------------------------------------- */

export function PaymentManager({ methods }: { methods: PaymentSettingRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<PaymentSettingRow | null>(null);

  const toggle = useAction(
    async ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/api/v1/admin/payments/${id}`, { active }),
    {
      onSuccess: () => {
        toast({ tone: "success", title: "وضعیت درگاه تغییر کرد" });
        router.refresh();
      },
      onError: (message) => toast({ tone: "error", title: "تغییر انجام نشد", description: message }),
    }
  );

  return (
    <Card padded={false}>
      <div className="border-b border-border p-4">
        <h2 className="font-bold text-fg">روش‌های پرداخت</h2>
        <p className="mt-1 text-xs text-fg-muted">
          تنظیمات نمایشی و کسب‌وکاری درگاه‌ها.
        </p>
      </div>

      <ul className="divide-y divide-border">
        {methods.map((method) => (
          <li key={method.id} className="p-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium text-fg">
                  {method.name}
                  {method.active
                    ? <Badge tone="success" size="sm">فعال</Badge>
                    : <Badge tone="neutral" size="sm">غیرفعال</Badge>}
                  {method.sandbox && <Badge tone="warning" size="sm">حالت آزمایشی</Badge>}
                </p>
                <p className="mt-1 text-xs text-fg-muted">{method.description}</p>
              </div>

              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => void toggle.run({ id: method.id, active: !method.active })}
                  disabled={toggle.pending}
                  className="h-9 rounded-md border border-border px-2.5 text-xs text-fg-muted hover:text-fg disabled:opacity-50"
                >
                  {method.active ? "غیرفعال کردن" : "فعال کردن"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(method)}
                  aria-label={`ویرایش ${method.name}`}
                  className="grid size-9 place-items-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-fg"
                >
                  <Pencil className="size-4" aria-hidden />
                </button>
              </div>
            </div>

            {/* Credential state as a boolean, never the value. */}
            <div
              className={cnJoin(
                "mt-3 flex items-start gap-2 rounded-md p-3 text-xs leading-6",
                method.credentialsConfigured ? "bg-success-soft" : "bg-warning-soft"
              )}
            >
              {method.credentialsConfigured ? (
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              ) : (
                <KeyRound className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              )}
              <span className="text-fg">
                <strong>
                  {method.credentialsConfigured
                    ? "اطلاعات اتصال درگاه تنظیم شده است."
                    : "اطلاعات اتصال درگاه تنظیم نشده است."}
                </strong>
                {method.credentialsHint && <> {method.credentialsHint}</>}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <PaymentModal
        open={editing !== null}
        method={editing}
        onClose={() => setEditing(null)}
        onDone={() => { setEditing(null); router.refresh(); }}
      />
    </Card>
  );
}

/** Local join helper — avoids pulling the whole utils module into this island. */
function cnJoin(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

function PaymentModal({
  open, method, onClose, onDone,
}: {
  open: boolean;
  method: PaymentSettingRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [seeded, setSeeded] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const key = method?.id ?? "none";
  if (open && seeded !== key) {
    setSeeded(key);
    setName(method?.name ?? "");
    setDescription(method?.description ?? "");
  }

  const save = useAction(
    async () =>
      api.patch(`/api/v1/admin/payments/${method!.id}`, {
        name: name.trim(),
        description: description.trim(),
      }),
    {
      onSuccess: () => {
        toast({ tone: "success", title: "تنظیمات درگاه ذخیره شد" });
        onDone();
      },
    }
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="ویرایش نمایش درگاه پرداخت"
      description="فقط عنوان و توضیحی که مشتری هنگام پرداخت می‌بیند."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={save.pending}>انصراف</Button>
          <Button type="submit" form="payment-form" loading={save.pending} disabled={save.pending}>
            ذخیره
          </Button>
        </div>
      }
    >
      <form
        id="payment-form"
        noValidate
        className="space-y-4"
        aria-busy={save.pending}
        onSubmit={(e) => { e.preventDefault(); void save.run(); }}
      >
        <Input
          label="عنوان نمایشی"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={save.pending}
        />
        <Textarea
          label="توضیح"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={save.pending}
        />

        <Alert tone="info" title="اطلاعات محرمانه درگاه اینجا نیست">
          مرچنت‌آیدی و کلیدهای درگاه، متغیرهای محیطی سرور هستند و عمداً از این فرم قابل مشاهده یا
          تغییر نیستند. برای تغییر آن‌ها مقدار <code dir="ltr">ZARINPAL_MERCHANT_ID</code> را در
          تنظیمات محیط سرور به‌روزرسانی کنید.
        </Alert>

        {save.error && <Alert tone="danger" role="alert">{save.error}</Alert>}
      </form>
    </Modal>
  );
}
