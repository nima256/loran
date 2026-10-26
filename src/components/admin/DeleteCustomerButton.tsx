"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlay";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Alert } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { useAction } from "@/lib/use-action";
import { normalizeIranMobile } from "@/lib/persian";

/** Deleting an account never deletes orders or their payment records. */
export function DeleteCustomerButton({
  customerId,
  customerName,
  phone,
  orderCount,
  fromDetails = false,
}: {
  customerId: string;
  customerName: string;
  phone: string;
  orderCount: number;
  fromDetails?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [confirmationPhone, setConfirmationPhone] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const confirmed = normalizeIranMobile(confirmationPhone) === phone && acknowledged;

  const remove = useAction(
    () => api.delete<{ deleted: true; retainedOrders: number; message: string }>(
      `/api/v1/admin/customers/${encodeURIComponent(customerId)}`,
      { body: { confirmationPhone } }
    ),
    {
      onSuccess: (result) => {
        setOpen(false);
        setConfirmationPhone("");
        setAcknowledged(false);
        toast({ tone: "success", title: "حساب مشتری حذف شد", description: result.message });
        if (fromDetails) router.replace("/admin/customers");
        router.refresh();
      },
      onError: (message) => {
        toast({ tone: "error", title: "حذف مشتری انجام نشد", description: message });
      },
    }
  );

  const close = () => {
    if (remove.pending) return;
    setOpen(false);
    setConfirmationPhone("");
    setAcknowledged(false);
    remove.reset();
  };

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        icon={<Trash2 className="size-4 text-danger" aria-hidden />}
        className="text-danger"
      >
        حذف مشتری
      </Button>
      <Modal
        open={open}
        onClose={close}
        title="حذف حساب مشتری"
        description={`آیا از حذف حساب «${customerName}» مطمئن هستید؟`}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" disabled={remove.pending} onClick={close}>
              انصراف
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={!confirmed || remove.pending}
              loading={remove.pending}
              onClick={() => void remove.run()}
            >
              حذف قطعی حساب
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Alert tone="warning" title="این عملیات قابل بازگشت نیست">
            حساب، نشست‌های ورود و آدرس‌های ذخیره‌شده مشتری حذف می‌شود. سفارش‌های قبلی
            و سوابق پرداخت ({orderCount} سفارش مرتبط) برای حفظ حسابداری باقی می‌مانند.
            مشتری می‌تواند بعداً با همین شماره دوباره حساب جدید ایجاد کند.
          </Alert>
          <p className="text-sm leading-7 text-fg-muted">
            برای جلوگیری از حذف اشتباهی، شماره موبایل زیر را دقیقاً در کادر وارد کنید:
            <strong className="ms-2 inline-block font-bold text-fg" dir="ltr">{phone}</strong>
          </p>
          <Input
            label="تأیید شماره موبایل مشتری"
            dir="ltr"
            placeholder="09XXXXXXXXX"
            value={confirmationPhone}
            onChange={(event) => setConfirmationPhone(event.target.value)}
            disabled={remove.pending}
            autoComplete="off"
          />
          <Checkbox
            label="متوجه هستم که حساب حذف می‌شود و این اقدام قابل بازگشت نیست."
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            disabled={remove.pending}
          />
          {remove.error && <Alert tone="danger" role="alert">{remove.error}</Alert>}
        </div>
      </Modal>
    </>
  );
}
