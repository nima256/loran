"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlay";
import { Select, Textarea } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { useAction } from "@/lib/use-action";

/**
 * Moderation controls for reviews, returns and storefront requests.
 *
 * Every one of these writes to the database and re-renders the server
 * component, so the queue the administrator sees is always the real state —
 * none of it is local React state that would evaporate on refresh.
 */

/* ------------------------------------------------------------- reviews ---- */

export function ReviewModerationButtons({
  reviewId,
  status,
}: {
  reviewId: string;
  status: "pending" | "approved" | "rejected";
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [target, setTarget] = useState<string | null>(null);

  const moderate = useAction(
    async (next: "approved" | "rejected" | "pending") => {
      setTarget(next);
      return api.patch(`/api/v1/admin/reviews/${reviewId}`, { status: next });
    },
    {
      onSuccess: () => {
        setTarget(null);
        toast({
          tone: "success",
          title: "وضعیت دیدگاه تغییر کرد",
          description: "امتیاز محصول دوباره از روی دیدگاه‌های تأییدشده محاسبه شد.",
        });
        router.refresh();
      },
      onError: (message) => {
        setTarget(null);
        toast({ tone: "error", title: "تغییر وضعیت انجام نشد", description: message });
      },
    }
  );

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "approved" && (
        <Button
          size="sm"
          loading={moderate.pending && target === "approved"}
          disabled={moderate.pending}
          onClick={() => void moderate.run("approved")}
          icon={<Check className="size-4" aria-hidden />}
        >
          تأیید و انتشار
        </Button>
      )}
      {status !== "rejected" && (
        <Button
          size="sm"
          variant="secondary"
          loading={moderate.pending && target === "rejected"}
          disabled={moderate.pending}
          onClick={() => void moderate.run("rejected")}
          icon={<X className="size-4" aria-hidden />}
        >
          {status === "approved" ? "برداشتن از فروشگاه" : "رد کردن"}
        </Button>
      )}
      {status !== "pending" && (
        <Button
          size="sm"
          variant="ghost"
          loading={moderate.pending && target === "pending"}
          disabled={moderate.pending}
          onClick={() => void moderate.run("pending")}
        >
          بازگشت به صف بررسی
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- returns ---- */

const RETURN_TRANSITIONS: Record<string, { value: string; label: string }[]> = {
  requested: [
    { value: "approved", label: "تأیید درخواست" },
    { value: "info_requested", label: "نیاز به اطلاعات بیشتر" },
    { value: "rejected", label: "رد درخواست" },
  ],
  info_requested: [
    { value: "approved", label: "تأیید درخواست" },
    { value: "rejected", label: "رد درخواست" },
  ],
  approved: [
    { value: "in_transit", label: "در مسیر بازگشت" },
    { value: "received", label: "مرسوله دریافت شد" },
    { value: "rejected", label: "رد درخواست" },
  ],
  in_transit: [{ value: "received", label: "مرسوله دریافت شد" }],
  received: [
    { value: "completed", label: "تکمیل شد" },
    { value: "refunded", label: "وجه بازگردانده شد" },
  ],
  completed: [{ value: "refunded", label: "وجه بازگردانده شد" }],
};

export function ReturnDecisionButton({
  requestId,
  status,
  adminNote,
}: {
  requestId: string;
  status: string;
  adminNote?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const options = RETURN_TRANSITIONS[status] ?? [];
  const [next, setNext] = useState(options[0]?.value ?? "");
  const [note, setNote] = useState("");
  const [internal, setInternal] = useState(adminNote ?? "");

  const decide = useAction(
    async () =>
      api.patch(`/api/v1/admin/returns/${requestId}`, {
        status: next,
        note: note.trim() || undefined,
        adminNote: internal.trim() || undefined,
      }),
    {
      onSuccess: () => {
        toast({
          tone: "success",
          title: "وضعیت درخواست تغییر کرد",
          description:
            next === "received"
              ? "کالاهای مرجوعی به موجودی انبار بازگشتند."
              : undefined,
        });
        setOpen(false);
        setNote("");
        router.refresh();
      },
      onError: (message) =>
        toast({ tone: "error", title: "تغییر وضعیت انجام نشد", description: message }),
    }
  );

  if (options.length === 0) {
    return (
      <p className="text-xs text-fg-subtle">
        این درخواست در وضعیت نهایی است و تغییر دیگری برای آن تعریف نشده.
      </p>
    );
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        تغییر وضعیت
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="بررسی درخواست مرجوعی"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={decide.pending}>
              انصراف
            </Button>
            <Button type="submit" form="return-decision" loading={decide.pending} disabled={decide.pending}>
              ثبت
            </Button>
          </div>
        }
      >
        <form
          id="return-decision"
          noValidate
          className="space-y-4"
          aria-busy={decide.pending}
          onSubmit={(e) => { e.preventDefault(); void decide.run(); }}
        >
          <Select
            label="وضعیت جدید"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            options={options}
            disabled={decide.pending}
          />
          <Textarea
            label="یادداشت برای مشتری"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            hint="در تاریخچه درخواست به مشتری نمایش داده می‌شود."
            disabled={decide.pending}
          />
          <Textarea
            label="یادداشت داخلی"
            rows={2}
            value={internal}
            onChange={(e) => setInternal(e.target.value)}
            disabled={decide.pending}
          />

          {next === "received" && (
            <Alert tone="warning">
              با ثبت «دریافت مرسوله»، کالاهای این درخواست به موجودی انبار بازگردانده می‌شوند.
            </Alert>
          )}

          {decide.error && <Alert tone="danger" role="alert">{decide.error}</Alert>}
        </form>
      </Modal>
    </>
  );
}

/* -------------------------------------------------- consultations/contact -- */

const REQUEST_STATUSES = [
  { value: "new", label: "جدید" },
  { value: "in_progress", label: "در حال بررسی" },
  { value: "contacted", label: "تماس گرفته شد" },
  { value: "completed", label: "تکمیل شده" },
  { value: "cancelled", label: "لغو شده" },
];

export function RequestStatusButton({
  endpoint,
  requestId,
  status,
  adminNote,
}: {
  /** "consultations" or "contact". */
  endpoint: string;
  requestId: string;
  status: string;
  adminNote?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState(status);
  const [note, setNote] = useState(adminNote ?? "");

  const save = useAction(
    async () =>
      api.patch(`/api/v1/admin/${endpoint}/${requestId}`, {
        ...(next !== status ? { status: next } : {}),
        adminNote: note.trim() || undefined,
      }),
    {
      onSuccess: () => {
        toast({ tone: "success", title: "درخواست به‌روزرسانی شد" });
        setOpen(false);
        router.refresh();
      },
      onError: (message) =>
        toast({ tone: "error", title: "به‌روزرسانی انجام نشد", description: message }),
    }
  );

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => setOpen(true)}
        icon={<MessageSquare className="size-4" aria-hidden />}
      >
        بررسی
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="بررسی درخواست"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={save.pending}>
              انصراف
            </Button>
            <Button type="submit" form="request-form" loading={save.pending} disabled={save.pending}>
              ذخیره
            </Button>
          </div>
        }
      >
        <form
          id="request-form"
          noValidate
          className="space-y-4"
          aria-busy={save.pending}
          onSubmit={(e) => { e.preventDefault(); void save.run(); }}
        >
          <Select
            label="وضعیت"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            options={REQUEST_STATUSES}
            disabled={save.pending}
          />
          <Textarea
            label="یادداشت داخلی"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={save.pending}
          />
          {save.error && <Alert tone="danger" role="alert">{save.error}</Alert>}
        </form>
      </Modal>
    </>
  );
}
