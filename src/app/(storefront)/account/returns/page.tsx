"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Overlay";
import { Alert, EmptyState, Skeleton } from "@/components/ui/Feedback";
import { Select, Textarea } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { PriceInline } from "@/components/ui/Price";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api/client";
import { useAction } from "@/lib/use-action";
import { formatDate, toPersianDigits } from "@/lib/format";
import { siteConfig } from "@/lib/site-config";

/**
 * Return and exchange requests.
 *
 * The customer picks specific *order items* and quantities, not just an order:
 * a single shoe out of a three-pair order is the common case. Eligibility comes
 * from the server — only delivered orders inside the return window, and only
 * the quantity not already covered by an open request.
 */

const TONE_TO_BADGE: Record<string, BadgeTone> = {
  requested: "warning",
  info_requested: "warning",
  approved: "info",
  in_transit: "info",
  received: "info",
  completed: "success",
  refunded: "success",
  rejected: "danger",
  cancelled: "neutral",
};

const REASONS = [
  "سایز مناسب نبود",
  "رنگ یا مدل با تصویر تفاوت داشت",
  "کالا ایراد یا نقص داشت",
  "کالای اشتباه ارسال شد",
  "نظرم عوض شد",
  "دلیل دیگر",
];

interface EligibleItem {
  id: string;
  name: string;
  image: string;
  colorName: string;
  size: number;
  unitPrice: number;
  quantity: number;
  available: number;
}

interface EligibleOrder {
  id: string;
  number: string;
  createdAt: string;
  deliveredAt?: string;
  items: EligibleItem[];
}

interface ReturnRequestView {
  id: string;
  number: string;
  orderNumber: string;
  type: "return" | "exchange";
  status: string;
  statusLabel: string;
  reason: string;
  customerNote?: string;
  adminNote?: string;
  refundAmount: number;
  createdAt: string;
  items: { id: string; name: string; colorName: string; size: number; quantity: number; unitPrice: number }[];
  timeline: { status: string; label: string; note?: string; at: string }[];
}

interface ReturnsPayload {
  requests: ReturnRequestView[];
  eligibleOrders: EligibleOrder[];
}

function ReturnsView() {
  const params = useSearchParams();
  const { toast } = useToast();

  const [data, setData] = useState<ReturnsPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const load = async () => {
    try {
      setData(await api.get<ReturnsPayload>("/api/v1/account/returns"));
    } catch (caught) {
      setLoadError(errorMessage(caught));
      setData({ requests: [], eligibleOrders: [] });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // Open the form straight away when arriving from an order page's button.
  const requestedOrder = params.get("order");
  useEffect(() => {
    if (requestedOrder && data?.eligibleOrders.length) setFormOpen(true);
  }, [requestedOrder, data]);

  const requests = data?.requests ?? [];
  const eligible = data?.eligibleOrders ?? [];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-fg sm:text-2xl">مرجوعی و تعویض</h1>
          <p className="mt-1.5 text-sm text-fg-muted">
            درخواست‌های ثبت‌شده و وضعیت رسیدگی به آن‌ها.
          </p>
        </div>
        <Button
          onClick={() => setFormOpen(true)}
          icon={<Plus className="size-4" aria-hidden />}
          disabled={eligible.length === 0}
        >
          درخواست جدید
        </Button>
      </header>

      <Alert tone="info" title={`مهلت ${toPersianDigits(siteConfig.commerce.returnWindowDays)} روزه`}>
        تا {toPersianDigits(siteConfig.commerce.returnWindowDays)} روز پس از تحویل، در صورتی که کفش
        استفاده نشده و بسته‌بندی آن سالم باشد، امکان تعویض یا مرجوعی وجود دارد.{" "}
        <Link href="/returns" className="text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]">
          شرایط کامل
        </Link>
      </Alert>

      {loadError && <Alert tone="danger" role="alert">{loadError}</Alert>}

      {data === null ? (
        <div className="space-y-3" role="status" aria-label="در حال بارگذاری درخواست‌ها">
          {[0, 1].map((i) => <Skeleton key={i} className="h-40 w-full rounded-lg" />)}
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={<RotateCcw className="size-7" aria-hidden />}
          title="درخواست مرجوعی ندارید"
          description={
            eligible.length > 0
              ? "اگر یکی از خریدهایتان مناسب نبود، از اینجا درخواست تعویض یا مرجوعی ثبت کنید."
              : "سفارش تحویل‌شده‌ای در مهلت مرجوعی ندارید."
          }
          action={
            eligible.length > 0
              ? <Button onClick={() => setFormOpen(true)}>ثبت درخواست</Button>
              : <ButtonLink href="/shop">رفتن به فروشگاه</ButtonLink>
          }
        />
      ) : (
        <ul className="space-y-3">
          {requests.map((request) => (
            <li key={request.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-fg">
                      {request.type === "return" ? "مرجوعی" : "تعویض"}
                      <span className="tnum break-token text-sm font-normal text-fg-muted" dir="ltr">
                        {request.orderNumber}
                      </span>
                    </p>
                    <p className="tnum mt-1 text-xs text-fg-muted">
                      <span dir="ltr">{request.number}</span> — ثبت شده در {formatDate(request.createdAt)}
                    </p>
                  </div>
                  <Badge tone={TONE_TO_BADGE[request.status] ?? "neutral"}>{request.statusLabel}</Badge>
                </div>

                <dl className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-fg-muted">دلیل</dt>
                    <dd className="text-end text-fg">{request.reason}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-fg-muted">کالاها</dt>
                    <dd className="tnum text-end text-fg">
                      {request.items
                        .map((i) => `${i.name} (${i.colorName}، سایز ${toPersianDigits(i.size)}) × ${toPersianDigits(i.quantity)}`)
                        .join("، ")}
                    </dd>
                  </div>
                  {request.refundAmount > 0 && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-fg-muted">مبلغ بازگشتی</dt>
                      <dd><PriceInline value={request.refundAmount} /></dd>
                    </div>
                  )}
                  {request.adminNote && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-fg-muted">پیام لوران</dt>
                      <dd className="text-end text-fg">{request.adminNote}</dd>
                    </div>
                  )}
                </dl>

                {/* The real history, from order-side events — not local state. */}
                {request.timeline.length > 1 && (
                  <ol className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs text-fg-muted">
                    {request.timeline.map((entry, index) => (
                      <li key={`${entry.status}-${index}`} className="flex flex-wrap justify-between gap-2">
                        <span className="text-fg">{entry.label}{entry.note ? ` — ${entry.note}` : ""}</span>
                        <span className="tnum">{formatDate(entry.at)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <ReturnRequestModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        orders={eligible}
        defaultOrderNumber={requestedOrder ?? undefined}
        onDone={async () => {
          setFormOpen(false);
          await load();
          toast({
            tone: "success",
            title: "درخواست شما ثبت شد",
            description: "کارشناس لوران طی یک روز کاری با شما تماس می‌گیرد.",
          });
        }}
      />
    </div>
  );
}

function ReturnRequestModal({
  open, onClose, orders, defaultOrderNumber, onDone,
}: {
  open: boolean;
  onClose: () => void;
  orders: EligibleOrder[];
  defaultOrderNumber?: string;
  onDone: () => Promise<void> | void;
}) {
  const initialOrder =
    orders.find((o) => o.number === defaultOrderNumber)?.id ?? orders[0]?.id ?? "";

  const [orderId, setOrderId] = useState(initialOrder);
  const [type, setType] = useState<"return" | "exchange">("exchange");
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState("");
  /** orderItemId → quantity being returned. */
  const [selection, setSelection] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<{ items?: string; note?: string }>({});

  // Reset the picked items whenever the order changes — they belong to it.
  useEffect(() => {
    setSelection({});
    setErrors({});
  }, [orderId]);

  useEffect(() => {
    if (open && !orderId) setOrderId(initialOrder);
  }, [open, orderId, initialOrder]);

  const order = useMemo(() => orders.find((o) => o.id === orderId), [orders, orderId]);

  const refundEstimate = useMemo(() => {
    if (!order || type !== "return") return 0;
    return order.items.reduce(
      (total, item) => total + (selection[item.id] ?? 0) * item.unitPrice,
      0
    );
  }, [order, selection, type]);

  const submit = useAction(
    async () => {
      const items = Object.entries(selection)
        .filter(([, quantity]) => quantity > 0)
        .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));

      return api.post("/api/v1/account/returns", {
        orderId,
        type,
        reason,
        customerNote: note.trim() || undefined,
        items,
      });
    },
    { onSuccess: onDone }
  );

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const chosen = Object.values(selection).filter((q) => q > 0).length;
    const next: typeof errors = {};
    if (!chosen) next.items = "حداقل یک کالا را برای مرجوعی انتخاب کنید.";
    if (note.trim().length > 0 && note.trim().length < 10) {
      next.note = "توضیح را کمی کامل‌تر بنویسید (حداقل ۱۰ حرف) یا خالی بگذارید.";
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    void submit.run();
  };

  const toggleItem = (item: EligibleItem, checked: boolean) => {
    setErrors((s) => ({ ...s, items: undefined }));
    setSelection((current) => {
      const next = { ...current };
      if (checked) next[item.id] = 1;
      else delete next[item.id];
      return next;
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="ثبت درخواست مرجوعی یا تعویض"
      description="پس از ثبت، کارشناس لوران برای هماهنگی جمع‌آوری مرسوله تماس می‌گیرد."
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={submit.pending}>انصراف</Button>
          <Button type="submit" form="return-form" loading={submit.pending} disabled={submit.pending}>
            ثبت درخواست
          </Button>
        </div>
      }
    >
      <form id="return-form" onSubmit={onSubmit} noValidate className="space-y-4" aria-busy={submit.pending}>
        <Select
          label="سفارش موردنظر"
          required
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          options={orders.map((o) => ({
            value: o.id,
            label: `${o.number} — ${formatDate(o.deliveredAt ?? o.createdAt)}`,
          }))}
          placeholder={orders.length ? undefined : "سفارش تحویل‌شده‌ای در مهلت مرجوعی ندارید"}
          disabled={submit.pending}
        />

        {/* Item-level selection: a customer usually returns one pair, not the
            whole order. `available` already excludes anything covered by an
            open request. */}
        {order && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-fg">
              کالاهای این سفارش <span className="text-primary" aria-hidden>*</span>
            </legend>
            <ul className="divide-y divide-border rounded-md border border-border">
              {order.items.map((item) => {
                const selected = selection[item.id] != null;
                return (
                  <li key={item.id} className="flex flex-wrap items-center gap-3 p-3">
                    <Checkbox
                      label={`${item.name} — ${item.colorName}، سایز ${toPersianDigits(item.size)}`}
                      checked={selected}
                      onChange={(e) => toggleItem(item, e.target.checked)}
                      disabled={submit.pending}
                    />
                    <div className="ms-auto flex items-center gap-3">
                      {item.available > 1 && selected && (
                        <QuantityStepper
                          value={selection[item.id] ?? 1}
                          min={1}
                          max={item.available}
                          onChange={(quantity) =>
                            setSelection((current) => ({ ...current, [item.id]: quantity }))
                          }
                          size="sm"
                        />
                      )}
                      <span className="tnum whitespace-nowrap text-xs text-fg-muted">
                        {toPersianDigits(item.available)} عدد قابل مرجوع
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
            {errors.items && (
              <p role="alert" className="mt-1.5 text-sm text-danger">{errors.items}</p>
            )}
          </fieldset>
        )}

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-fg">نوع درخواست</legend>
          <div className="grid grid-cols-2 gap-2">
            {([["exchange", "تعویض سایز"], ["return", "مرجوعی و بازگشت وجه"]] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                aria-pressed={type === value}
                disabled={submit.pending}
                className={[
                  "flex min-h-12 items-center justify-center rounded-md border px-3 text-sm transition-colors",
                  type === value
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
          label="دلیل"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          options={REASONS.map((r) => ({ value: r, label: r }))}
          disabled={submit.pending}
        />

        <Textarea
          label="توضیحات"
          rows={4}
          value={note}
          onChange={(e) => { setNote(e.target.value); setErrors((s) => ({ ...s, note: undefined })); }}
          error={errors.note}
          hint="هرچه دقیق‌تر بنویسید، رسیدگی سریع‌تر انجام می‌شود."
          placeholder="مثلاً: سایز ۴۲ سفارش دادم ولی کمی تنگ است و سایز ۴۳ می‌خواهم."
          disabled={submit.pending}
        />

        {type === "return" && refundEstimate > 0 && (
          <p className="tnum rounded-md bg-surface-2 p-3 text-sm text-fg-muted">
            مبلغ تقریبی بازگشتی: <PriceInline value={refundEstimate} /> — مبلغ نهایی پس از بررسی
            کالا توسط لوران تأیید می‌شود.
          </p>
        )}

        {submit.error && <Alert tone="danger" role="alert">{submit.error}</Alert>}

        <Alert tone="warning">
          کالا باید استفاده‌نشده و همراه جعبه و برچسب اصلی باشد. هزینه ارسال مرجوعی طبق شرایط
          درج‌شده در صفحه مرجوعی محاسبه می‌شود.
        </Alert>
      </form>
    </Modal>
  );
}

export default function ReturnsPage() {
  return (
    <Suspense fallback={<div className="skeleton h-96 rounded-lg" />}>
      <ReturnsView />
    </Suspense>
  );
}
