"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, CircleDollarSign, Clock, PackageCheck, Save, ShieldAlert, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Modal } from "@/components/ui/Overlay";
import { Alert } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { useAction } from "@/lib/use-action";
import { ORDER_STATUS_LABELS, ORDER_STATUS_FLOW } from "@/lib/orders";
import type { AnyOrderStatus } from "@/types";

/**
 * The admin's write actions on an order.
 *
 * Only transitions the server's workflow actually permits are offered, so an
 * impossible status is never presented — and the server re-checks anyway.
 * Every action goes through `useAction`, which holds its own in-flight guard,
 * so a double-click cannot fire two status changes.
 */

const STATUS_ICONS = [CircleDollarSign, Clock, PackageCheck, Truck, CheckCircle2] as const;

/** Select operational statuses from the timeline itself; cancellation is separate. */
export function OrderStatusActions({
  orderId, orderNumber, status, paymentStatus,
}: {
  orderId: string;
  orderNumber: string;
  status: AnyOrderStatus;
  paymentStatus: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [target, setTarget] = useState<string | null>(null);
  const [cancelStep, setCancelStep] = useState<0 | 1 | 2>(0);
  const [cancelAcknowledged, setCancelAcknowledged] = useState(false);
  const closeCancel = () => {
    if (!change.pending) { setCancelStep(0); setCancelAcknowledged(false); }
  };
  const change = useAction(
    async (next: string) => {
      setTarget(next);
      return api.post(`/api/v1/admin/orders/${orderId}/status`, {
        status: next,
        expectedStatus: status,
        ...(next === "cancelled" ? {
          cancellationConfirmation: { orderNumber, acknowledged: true },
        } : {}),
      });
    },
    {
      onSuccess: () => {
        setTarget(null);
        setCancelStep(0);
        setCancelAcknowledged(false);
        toast({ tone: "success", title: "وضعیت سفارش تغییر کرد" });
        router.refresh();
      },
      onError: (message) => {
        setTarget(null);
        toast({ tone: "error", title: "تغییر وضعیت انجام نشد", description: message });
      },
    }
  );

  const currentIndex = ORDER_STATUS_FLOW.indexOf(status as typeof ORDER_STATUS_FLOW[number]);
  const canSetStage = paymentStatus === "paid" && status !== "refunded";
  const canCancel = ["awaiting_payment", "preparing", "packaged", "payment_failed", "expired"].includes(status);

  return (
    <div className="mt-5 border-t border-border pt-5">
      <p className="mb-4 text-xs leading-6 text-fg-muted">
        برای تغییر وضعیت سفارش روی دایره مرحله موردنظر کلیک کنید. تغییرات در تاریخچه ثبت می‌شوند.
      </p>
      <ol className="grid grid-cols-5 gap-1 sm:gap-2" aria-label="تغییر مرحله سفارش">
        {ORDER_STATUS_FLOW.map((step, index) => {
          const Icon = STATUS_ICONS[index];
          const active = index === currentIndex;
          const reached = index <= currentIndex;
          const enabled = !change.pending && !active && canSetStage && index > 0;
          return (
            <li key={step} className="relative min-w-0 text-center">
              <button type="button"
                aria-label={`تغییر وضعیت به ${ORDER_STATUS_LABELS[step]}`}
                aria-current={active ? "step" : undefined}
                disabled={!enabled}
                onClick={() => { void change.run(step); }}
                className={`mx-auto grid size-9 place-items-center rounded-full border-2 transition-colors sm:size-11 ${
                  active ? "border-primary bg-primary text-primary-fg" :
                  reached ? "border-primary text-primary" : "border-border text-fg-subtle"
                } ${enabled ? "cursor-pointer hover:bg-primary-soft hover:text-primary-soft-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" : "cursor-default"}`}
              >
                <Icon className="size-4 sm:size-5" aria-hidden />
              </button>
              <span className={`mt-2 block text-[0.65rem] leading-5 sm:text-xs ${active ? "font-semibold text-fg" : "text-fg-muted"}`}>
                {ORDER_STATUS_LABELS[step]}
              </span>
              {change.pending && target === step && <span className="mt-1 block text-[10px] text-fg-muted">در حال ثبت…</span>}
            </li>
          );
        })}
      </ol>
      {!canSetStage && (
        <Alert tone="info" className="mt-4">
          مرحله‌های عملیاتی فقط برای سفارش‌های پرداخت‌شده قابل تغییر هستند؛ وضعیت پرداخت از طریق این نمودار تغییر نمی‌کند.
        </Alert>
      )}
      {change.error && <Alert tone="danger" className="mt-4" role="alert">{change.error}</Alert>}
      <div className="mt-5 border-t border-border pt-4">
        {canCancel && (
          <Button type="button" size="sm" variant="danger" disabled={change.pending}
            onClick={() => setCancelStep(1)} icon={<ShieldAlert className="size-4" aria-hidden />}>
            لغو سفارش
          </Button>
        )}
        <p className="mt-2 text-xs text-fg-subtle">
          لغو سفارش مستقل از مراحل بالاست و تنها با تأیید دومرحله‌ای انجام می‌شود. لغو، بازپرداخت خودکار بانکی نیست.
        </p>
      </div>
      <Modal
        open={cancelStep !== 0}
        onClose={closeCancel}
        title={cancelStep === 1 ? "تأیید مرحله اول لغو سفارش" : "تأیید نهایی لغو سفارش"}
        description={`شماره سفارش: ${orderNumber}`}
        size="sm"
        footer={<div className="flex flex-wrap justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" disabled={change.pending} onClick={closeCancel}>انصراف</Button>
          {cancelStep === 1 ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => setCancelStep(2)}>ادامه به مرحله دوم</Button>
          ) : (
            <Button type="button" size="sm" variant="danger"
              loading={change.pending && target === "cancelled"}
              disabled={change.pending || !cancelAcknowledged}
              onClick={() => void change.run("cancelled")}>
              تأیید نهایی و لغو سفارش
            </Button>
          )}
        </div>}
      >
        <div className="space-y-3 text-sm leading-7 text-fg">
          <div className="flex gap-2 rounded-md bg-danger-soft p-3 text-danger">
            <ShieldAlert className="mt-1 size-5 shrink-0" aria-hidden />
            <p>لغو سفارش، آماده‌سازی آن را متوقف می‌کند و اگر موجودی کسر شده باشد به انبار بازمی‌گردد.</p>
          </div>
          {cancelStep === 1 ? (
            <p>برای جلوگیری از لغو تصادفی، اثر این اقدام را در مرحله بعد جداگانه تأیید کنید.</p>
          ) : (
            <Checkbox label="تأیید می‌کنم که قصد لغو همین سفارش را دارم و از اثر آن بر موجودی اطلاع دارم."
              checked={cancelAcknowledged} disabled={change.pending}
              onChange={(e) => setCancelAcknowledged(e.target.checked)} />
          )}
          {change.error && <Alert tone="danger" role="alert">{change.error}</Alert>}
        </div>
      </Modal>
    </div>
  );
}

/** A reversible administrative removal; never destroys financial records. */
export function DeleteOrderButton({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [typedNumber, setTypedNumber] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  const remove = useAction(
    async () => api.delete<{ message: string }>(`/api/v1/admin/orders/${orderId}`, {
      body: { orderNumber: typedNumber.trim(), acknowledged: true },
    }),
    {
      onSuccess: ({ message }) => {
        toast({ tone: "success", title: "سفارش از لیست حذف شد", description: message });
        router.replace("/admin/orders");
        router.refresh();
      },
      onError: (message) => toast({ tone: "error", title: "حذف سفارش انجام نشد", description: message }),
    }
  );

  const close = () => {
    if (remove.pending) return;
    setOpen(false);
    setTypedNumber("");
    setAcknowledged(false);
  };

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)} icon={<Trash2 className="size-4" aria-hidden />} className="text-danger hover:text-danger">
        حذف سفارش
      </Button>
      <Modal
        open={open}
        onClose={close}
        title="حذف سفارش از فهرست‌ها"
        description={`سفارش ${orderNumber}`}
        size="sm"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" disabled={remove.pending} onClick={close}>انصراف</Button>
            <Button
              type="button" size="sm" variant="danger"
              loading={remove.pending}
              disabled={remove.pending || typedNumber.trim() !== orderNumber || !acknowledged}
              onClick={() => void remove.run()}
              icon={<Trash2 className="size-4" aria-hidden />}
            >
              حذف از لیست‌ها
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm leading-7 text-fg">
          <p>این سفارش از فهرست مدیریت و پنل کاربر پنهان می‌شود. اطلاعات پرداخت، گردش مالی و موجودی انبار حذف یا اصلاح نمی‌شوند.</p>
          <p className="text-xs text-fg-muted">این عمل به معنی لغو سفارش یا استرداد وجه نیست. اگر می‌خواهید موجودی برگردد، ابتدا از بخش وضعیت سفارش را لغو کنید.</p>
          <Input
            label="برای تأیید، کد کامل سفارش را وارد کنید"
            value={typedNumber}
            onChange={(e) => setTypedNumber(e.target.value)}
            placeholder={orderNumber}
            dir="ltr"
            disabled={remove.pending}
            autoComplete="off"
          />
          <Checkbox
            label="تأیید می‌کنم سفارش از فهرست‌ها پنهان شود و سوابق مالی حفظ شوند."
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            disabled={remove.pending}
          />
          {remove.error && <Alert tone="danger" role="alert">{remove.error}</Alert>}
        </div>
      </Modal>
    </>
  );
}

export function TrackingForm({
  orderId,
  carriers,
  currentCarrier,
  currentCode,
  smsAvailable,
}: {
  orderId: string;
  carriers: { code: string; name: string }[];
  currentCarrier?: string;
  currentCode?: string;
  smsAvailable: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [carrier, setCarrier] = useState(currentCarrier ?? carriers[0]?.name ?? "");
  const [code, setCode] = useState(currentCode ?? "");
  const [notify, setNotify] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const save = useAction(
    async () =>
      api.post<{ advancedToShipped: boolean; smsSent: boolean }>(
        `/api/v1/admin/orders/${orderId}/tracking`,
        { carrier, trackingCode: code.trim(), notifyCustomer: notify }
      ),
    {
      onSuccess: (result) => {
        toast({
          tone: "success",
          title: "کد رهگیری ثبت شد",
          description: [
            result.advancedToShipped ? "وضعیت سفارش به «ارسال شد» تغییر کرد." : null,
            result.smsSent ? "پیامک اطلاع‌رسانی برای مشتری ارسال شد." : null,
          ]
            .filter(Boolean)
            .join(" ") || "کد رهگیری برای مشتری قابل مشاهده است.",
        });
        router.refresh();
      },
      onError: (message) =>
        toast({ tone: "error", title: "ثبت کد رهگیری انجام نشد", description: message }),
    }
  );

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (code.trim().length < 4) {
      setFieldError("کد رهگیری را کامل وارد کنید.");
      return;
    }
    setFieldError(null);
    void save.run();
  };

  return (
    <form onSubmit={submit} noValidate aria-busy={save.pending}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="شرکت حمل"
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
          options={carriers.map((c) => ({ value: c.name, label: c.name }))}
          disabled={save.pending}
        />
        <Input
          label="کد رهگیری"
          dir="ltr"
          className="[&_input]:text-start"
          value={code}
          onChange={(e) => { setCode(e.target.value); setFieldError(null); }}
          error={fieldError ?? undefined}
          placeholder="TPX…"
          hint="پس از تحویل مرسوله به شرکت حمل وارد کنید."
          disabled={save.pending}
        />
      </div>

      {smsAvailable && (
        <Checkbox
          className="mt-3"
          label="ارسال پیامک اطلاع‌رسانی برای مشتری"
          checked={notify}
          onChange={(e) => setNotify(e.target.checked)}
          disabled={save.pending}
        />
      )}

      <Button
        type="submit"
        size="sm"
        className="mt-4"
        loading={save.pending}
        disabled={save.pending}
        icon={<Truck className="size-4" aria-hidden />}
      >
        ثبت کد رهگیری
      </Button>

      {save.error && <Alert tone="danger" role="alert" className="mt-3">{save.error}</Alert>}
    </form>
  );
}

export function AdminNoteForm({ orderId, initial }: { orderId: string; initial?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [note, setNote] = useState(initial ?? "");

  const save = useAction(
    async () => api.patch(`/api/v1/admin/orders/${orderId}/note`, { adminNote: note }),
    {
      onSuccess: () => {
        toast({ tone: "success", title: "یادداشت ذخیره شد" });
        router.refresh();
      },
      onError: (message) =>
        toast({ tone: "error", title: "ذخیره نشد", description: message }),
    }
  );

  return (
    <div aria-busy={save.pending}>
      <Textarea
        label="یادداشت داخلی"
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        hint="فقط برای تیم لوران قابل مشاهده است و به مشتری نمایش داده نمی‌شود."
        disabled={save.pending}
      />
      <Button
        size="sm"
        variant="secondary"
        className="mt-3"
        loading={save.pending}
        disabled={save.pending || note === (initial ?? "")}
        onClick={() => void save.run()}
        icon={<Save className="size-4" aria-hidden />}
      >
        ذخیره یادداشت
      </Button>
      {save.error && <Alert tone="danger" role="alert" className="mt-3">{save.error}</Alert>}
    </div>
  );
}
