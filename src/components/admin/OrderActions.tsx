"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Undo2, Save, ShieldAlert, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Modal } from "@/components/ui/Overlay";
import { Alert } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { useAction } from "@/lib/use-action";
import { ORDER_STATUS_LABELS } from "@/lib/orders";
import type { AnyOrderStatus } from "@/types";

/**
 * The admin's write actions on an order.
 *
 * Only transitions the server's workflow actually permits are offered, so an
 * impossible status is never presented — and the server re-checks anyway.
 * Every action goes through `useAction`, which holds its own in-flight guard,
 * so a double-click cannot fire two status changes.
 */

export function OrderStatusActions({
  orderId,
  orderNumber,
  status,
  allowedStatuses,
  previousStatus,
  paymentStatus,
}: {
  orderId: string;
  orderNumber: string;
  status: AnyOrderStatus;
  allowedStatuses: string[];
  previousStatus: AnyOrderStatus | null;
  paymentStatus: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [target, setTarget] = useState<string | null>(null);
  const [cancelStep, setCancelStep] = useState<0 | 1 | 2>(0);
  const [cancelAcknowledged, setCancelAcknowledged] = useState(false);
  const [undoOpen, setUndoOpen] = useState(false);
  const [cancelIsUndo, setCancelIsUndo] = useState(false);

  const closeCancel = () => {
    if (change.pending) return;
    setCancelStep(0);
    setCancelAcknowledged(false);
    setCancelIsUndo(false);
  };

  const change = useAction(
    async ({ next, undo = false }: { next: string; undo?: boolean }) => {
      setTarget(next);
      return api.post(`/api/v1/admin/orders/${orderId}/status`, {
        status: next,
        expectedStatus: status,
        ...(undo ? { undo: true } : {}),
        note: note.trim() || undefined,
        ...(next === "cancelled" ? {
          cancellationConfirmation: { orderNumber, acknowledged: true },
        } : {}),
      });
    },
    {
      onSuccess: () => {
        setNote("");
        setTarget(null);
        setCancelStep(0);
        setCancelAcknowledged(false);
        setCancelIsUndo(false);
        setUndoOpen(false);
        toast({ tone: "success", title: "وضعیت سفارش تغییر کرد" });
        router.refresh();
      },
      onError: (message) => {
        setTarget(null);
        toast({ tone: "error", title: "تغییر وضعیت انجام نشد", description: message });
      },
    }
  );

  const showUndo = Boolean(previousStatus && previousStatus !== status);
  const requiresCancellationConfirmation = previousStatus === "cancelled";
  // A financial refund cannot be undone just by changing a status label.
  const hasRefundWarning = status === "refunded" || paymentStatus === "refunded";

  return (
    <div className="mt-6 border-t border-border pt-4">
      <h3 className="mb-3 text-sm font-medium text-fg">تغییر وضعیت</h3>

      <Textarea
        label="یادداشت (اختیاری)"
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        hint="در تاریخچه سفارش ثبت می‌شود."
        disabled={change.pending}
        className="mb-3"
      />

      {showUndo && previousStatus && (
        <div className="mb-3 rounded-lg border border-border bg-surface-2 p-3">
          <p className="mb-2 text-xs leading-6 text-fg-muted">
            وضعیت قبلی این سفارش: «{ORDER_STATUS_LABELS[previousStatus]}». با بازگشت، وضعیت جدید در تاریخچه سفارش ثبت می‌شود.
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={change.pending && target === previousStatus}
            disabled={change.pending}
            onClick={() => {
              if (requiresCancellationConfirmation) { setCancelIsUndo(true); setCancelStep(1); }
              else setUndoOpen(true);
            }}
            icon={<Undo2 className="size-4" aria-hidden />}
          >
            بازگشت به «{ORDER_STATUS_LABELS[previousStatus]}»
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {allowedStatuses.filter((next) => next !== previousStatus).map((next) => (
          <Button
            key={next}
            type="button"
            size="sm"
            variant={next === "cancelled" || next === "refunded" ? "ghost" : "secondary"}
            loading={change.pending && target === next}
            disabled={change.pending}
            onClick={() => next === "cancelled" ? (setCancelIsUndo(false), setCancelStep(1)) : void change.run({ next })}
            className={next === "cancelled" || next === "refunded" ? "text-danger" : undefined}
          >
            {ORDER_STATUS_LABELS[next as AnyOrderStatus] ?? next}
          </Button>
        ))}
      </div>

      {allowedStatuses.length === 0 && !showUndo && (
        <Alert tone="info">این سفارش در وضعیت «{ORDER_STATUS_LABELS[status]}» است و وضعیت قبلی قابل بازیابی ندارد.</Alert>
      )}

      {change.error && <Alert tone="danger" role="alert" className="mt-3">{change.error}</Alert>}

      <p className="mt-3 text-xs text-fg-subtle">
        لغو سفارشی که موجودی آن کسر شده، کالاها را به انبار بازمی‌گرداند. لغو پرداخت، بازپرداخت خودکار بانکی نیست.
      </p>

      <Modal
        open={undoOpen}
        onClose={() => { if (!change.pending) setUndoOpen(false); }}
        title="بازگشت به وضعیت قبلی سفارش"
        description={`سفارش ${orderNumber}`}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={change.pending} onClick={() => setUndoOpen(false)}>انصراف</Button>
            <Button
              type="button" variant="secondary" size="sm"
              disabled={change.pending || !previousStatus || requiresCancellationConfirmation}
              loading={change.pending && target === previousStatus}
              onClick={() => { if (previousStatus) void change.run({ next: previousStatus, undo: true }); }}
              icon={<Undo2 className="size-4" aria-hidden />}
            >
              تأیید بازگشت وضعیت
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm leading-7 text-fg">
          <p>وضعیت سفارش از «{ORDER_STATUS_LABELS[status]}» به «{previousStatus ? ORDER_STATUS_LABELS[previousStatus] : "وضعیت قبلی"}» برمی‌گردد.</p>
          {requiresCancellationConfirmation && (
            <Alert tone="warning">بازگشت به «لغو شده» نیاز به تأیید دومرحله‌ای دارد. از بخش تغییر وضعیت، دکمه «لغو شده» را انتخاب کنید.</Alert>
          )}
          {(status === "cancelled" || status === "returned") && (
            <Alert tone="warning">در صورت برگشت به مرحله فعال، موجودی کالا مجدداً از انبار کم می‌شود؛ اگر موجودی کافی نباشد عملیات انجام نمی‌شود.</Alert>
          )}
          {hasRefundWarning && (
            <Alert tone="warning">برگشت وضعیت، استرداد انجام‌شده را باطل نمی‌کند و وضعیت واقعی پرداخت تغییر نخواهد کرد.</Alert>
          )}
          {(status === "shipped" || status === "delivered") && (
            <p className="text-xs text-fg-muted">اطلاعات کد رهگیری حفظ می‌شود، اما تاریخ‌های ارسال و تحویل متناسب با وضعیت به‌روزرسانی می‌شوند.</p>
          )}
          {change.error && <Alert tone="danger" role="alert">{change.error}</Alert>}
        </div>
      </Modal>

      <Modal
        open={cancelStep !== 0}
        onClose={closeCancel}
        title={cancelStep === 1 ? "تأیید مرحله اول لغو سفارش" : "تأیید نهایی لغو سفارش"}
        description={`شماره سفارش: ${orderNumber}`}
        size="sm"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" disabled={change.pending} onClick={closeCancel}>انصراف</Button>
            {cancelStep === 1 ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => setCancelStep(2)}>
                ادامه به مرحله دوم
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="danger"
                loading={change.pending && target === "cancelled"}
                disabled={change.pending || !cancelAcknowledged}
                onClick={() => void change.run({ next: "cancelled", undo: cancelIsUndo })}
              >
                تأیید نهایی و لغو سفارش
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-3 text-sm leading-7 text-fg">
          <div className="flex gap-2 rounded-md bg-danger-soft p-3 text-danger">
            <ShieldAlert className="mt-1 size-5 shrink-0" aria-hidden />
            <p>با لغو سفارش، ادامه آماده‌سازی یا ارسال آن متوقف می‌شود. اگر موجودی کالا قبلاً کسر شده، به انبار بازمی‌گردد.</p>
          </div>
          {cancelStep === 1 ? (
            <p>برای جلوگیری از لغو تصادفی، در مرحله بعد باید اثر این اقدام را جداگانه تأیید کنید.</p>
          ) : (
            <Checkbox
              label="تأیید می‌کنم که قصد لغو همین سفارش را دارم و اثر آن روی موجودی را می‌دانم."
              checked={cancelAcknowledged}
              disabled={change.pending}
              onChange={(e) => setCancelAcknowledged(e.target.checked)}
            />
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
