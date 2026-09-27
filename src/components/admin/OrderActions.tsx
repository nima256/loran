"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Save, Truck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
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
  status,
  allowedStatuses,
}: {
  orderId: string;
  status: AnyOrderStatus;
  allowedStatuses: string[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [target, setTarget] = useState<string | null>(null);

  const change = useAction(
    async (next: string) => {
      setTarget(next);
      return api.post(`/api/v1/admin/orders/${orderId}/status`, {
        status: next,
        note: note.trim() || undefined,
      });
    },
    {
      onSuccess: () => {
        setNote("");
        setTarget(null);
        toast({ tone: "success", title: "وضعیت سفارش تغییر کرد" });
        // Re-render the server component so the timeline reflects the change.
        router.refresh();
      },
      onError: (message) => {
        setTarget(null);
        toast({ tone: "error", title: "تغییر وضعیت انجام نشد", description: message });
      },
    }
  );

  if (allowedStatuses.length === 0) {
    return (
      <Alert tone="info" className="mt-4">
        این سفارش در وضعیت «{ORDER_STATUS_LABELS[status]}» است و تغییر وضعیت دیگری برای آن تعریف
        نشده است.
      </Alert>
    );
  }

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

      <div className="flex flex-wrap gap-2">
        {allowedStatuses.map((next) => (
          <Button
            key={next}
            size="sm"
            variant={next === "cancelled" || next === "refunded" ? "ghost" : "secondary"}
            loading={change.pending && target === next}
            disabled={change.pending}
            onClick={() => void change.run(next)}
            className={
              next === "cancelled" || next === "refunded"
                ? "text-fg-muted hover:text-danger"
                : undefined
            }
          >
            {ORDER_STATUS_LABELS[next as AnyOrderStatus] ?? next}
          </Button>
        ))}
      </div>

      {change.error && (
        <Alert tone="danger" role="alert" className="mt-3">{change.error}</Alert>
      )}

      <p className="mt-3 text-xs text-fg-subtle">
        فقط تغییرهای مجاز در گردش‌کار سفارش نمایش داده می‌شوند. لغو سفارشی که موجودی آن کسر شده،
        کالاها را به انبار بازمی‌گرداند.
      </p>
    </div>
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
