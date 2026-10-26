"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlay";
import { Input, Textarea } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Alert } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { api, ApiClientError } from "@/lib/api/client";
import { useAction } from "@/lib/use-action";

/**
 * Manual customer creation and editing.
 *
 * There is no password field, and that is the point: customers authenticate
 * with phone + OTP. An administrator fills in the profile ahead of time and the
 * customer signs in through exactly the same flow as everyone else — inventing
 * a default password for them would be strictly worse than having none.
 */

export interface CustomerFormValues {
  id?: string;
  phone: string;
  firstName: string;
  lastName: string;
  email: string;
  nationalId: string;
  note: string;
  blocked: boolean;
  smsNotifications: boolean;
}

const EMPTY: CustomerFormValues = {
  phone: "",
  firstName: "",
  lastName: "",
  email: "",
  nationalId: "",
  note: "",
  blocked: false,
  smsNotifications: true,
};

export function NewCustomerButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} icon={<Plus className="size-4" aria-hidden />}>
        افزودن مشتری
      </Button>
      <CustomerModal open={open} onClose={() => setOpen(false)} initial={EMPTY} mode="create" />
    </>
  );
}

export function EditCustomerButton({ customer }: { customer: CustomerFormValues }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        ویرایش اطلاعات
      </Button>
      <CustomerModal open={open} onClose={() => setOpen(false)} initial={customer} mode="edit" />
    </>
  );
}

function CustomerModal({
  open, onClose, initial, mode,
}: {
  open: boolean;
  onClose: () => void;
  initial: CustomerFormValues;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState(initial);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof CustomerFormValues>(key: K, value: CustomerFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setFieldErrors((e) => ({ ...e, [key as string]: "" }));
  };

  const save = useAction(
    async () => {
      const payload = {
        phone: values.phone.trim(),
        firstName: values.firstName.trim() || undefined,
        lastName: values.lastName.trim() || undefined,
        email: values.email.trim() || undefined,
        nationalId: values.nationalId.trim() || undefined,
        note: values.note.trim() || undefined,
        blocked: values.blocked,
        smsNotifications: values.smsNotifications,
      };
      return mode === "create"
        ? api.post<{ message: string }>("/api/v1/admin/customers", payload)
        : api.patch<{ message?: string }>(`/api/v1/admin/customers/${initial.id}`, payload);
    },
    {
      onSuccess: (result) => {
        toast({
          tone: "success",
          title: mode === "create" ? "مشتری ثبت شد" : "اطلاعات مشتری ذخیره شد",
          description: result.message,
        });
        onClose();
        router.refresh();
      },
      onError: (message, error) => {
        // Surface field-level messages next to the inputs they belong to.
        if (error instanceof ApiClientError && error.details) {
          setFieldErrors({
            phone: error.fieldError("phone") ?? "",
            email: error.fieldError("email") ?? "",
          });
        }
        toast({ tone: "error", title: "ذخیره انجام نشد", description: message });
      },
    }
  );

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!values.phone.trim()) {
      setFieldErrors({ phone: "شماره موبایل را وارد کنید." });
      return;
    }
    void save.run();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "افزودن مشتری" : "ویرایش مشتری"}
      description="ورود مشتری با شماره موبایل و کد پیامکی انجام می‌شود؛ رمز عبوری لازم نیست."
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={save.pending}>انصراف</Button>
          <Button type="submit" form="customer-form" loading={save.pending} disabled={save.pending}>
            ذخیره
          </Button>
        </div>
      }
    >
      <form id="customer-form" onSubmit={submit} noValidate className="space-y-4" aria-busy={save.pending}>
        <Input
          label="شماره موبایل"
          required
          dir="ltr"
          className="[&_input]:text-start"
          value={values.phone}
          onChange={(e) => set("phone", e.target.value)}
          error={fieldErrors.phone || undefined}
          placeholder="09123456789"
          hint="شماره موبایل، شناسه یکتای ورود مشتری است."
          disabled={save.pending}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="نام"
            value={values.firstName}
            onChange={(e) => set("firstName", e.target.value)}
            disabled={save.pending}
          />
          <Input
            label="نام خانوادگی"
            value={values.lastName}
            onChange={(e) => set("lastName", e.target.value)}
            disabled={save.pending}
          />
        </div>

        <Input
          label="ایمیل"
          type="email"
          dir="ltr"
          className="[&_input]:text-start"
          value={values.email}
          onChange={(e) => set("email", e.target.value)}
          error={fieldErrors.email || undefined}
          disabled={save.pending}
        />

        <Input
          label="کد ملی"
          dir="ltr"
          className="[&_input]:text-start"
          value={values.nationalId}
          onChange={(e) => set("nationalId", e.target.value.replace(/\D/g, ""))}
          disabled={save.pending}
        />

        <Textarea
          label="یادداشت داخلی"
          rows={2}
          value={values.note}
          onChange={(e) => set("note", e.target.value)}
          hint="به مشتری نمایش داده نمی‌شود."
          disabled={save.pending}
        />

        <Checkbox
          label="دریافت پیامک وضعیت سفارش"
          checked={values.smsNotifications}
          onChange={(e) => set("smsNotifications", e.target.checked)}
          disabled={save.pending}
        />

        <Checkbox
          label="مسدود کردن حساب (امکان ورود و ثبت سفارش ندارد)"
          checked={values.blocked}
          onChange={(e) => set("blocked", e.target.checked)}
          disabled={save.pending}
        />

        {values.blocked && (
          <Alert tone="warning">
            با مسدود کردن، نشست‌های فعال این مشتری بلافاصله باطل می‌شوند.
          </Alert>
        )}

        {save.error && <Alert tone="danger" role="alert">{save.error}</Alert>}
      </form>
    </Modal>
  );
}
