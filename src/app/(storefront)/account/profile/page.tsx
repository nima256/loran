"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { useAction } from "@/lib/use-action";
import { useAuth } from "@/store/AuthProvider";
import { formatDate, formatPhone, isValidEmail } from "@/lib/format";

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();

  const [values, setValues] = useState({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
    nationalId: user?.nationalId ?? "",
    birthDate: user?.birthDate ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  /** Persists the profile through the account API. */
  const save = useAction(async () => updateUser(values), {
    onSuccess: () => toast({ tone: "success", title: "اطلاعات حساب ذخیره شد" }),
    onError: (message) =>
      toast({ tone: "error", title: "ذخیره انجام نشد", description: message }),
  });

  const set = (key: keyof typeof values, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!values.firstName.trim()) next.firstName = "نام را وارد کنید.";
    if (!values.lastName.trim()) next.lastName = "نام خانوادگی را وارد کنید.";
    if (values.email && !isValidEmail(values.email)) next.email = "ایمیل واردشده معتبر نیست.";
    if (values.nationalId && !/^\d{10}$/.test(values.nationalId)) next.nationalId = "کد ملی باید ۱۰ رقم باشد.";
    setErrors(next);
    if (Object.keys(next).length) return;

    void save.run();
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-fg sm:text-2xl">اطلاعات حساب</h1>
        <p className="mt-1.5 text-sm text-fg-muted">این اطلاعات روی فاکتورها و هنگام تماس پشتیبانی استفاده می‌شود.</p>
      </header>

      <Card>
        <form onSubmit={submit} noValidate className="space-y-4" aria-busy={save.pending}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="نام" required autoComplete="given-name" value={values.firstName}
              onChange={(e) => set("firstName", e.target.value)} error={errors.firstName} />
            <Input label="نام خانوادگی" required autoComplete="family-name" value={values.lastName}
              onChange={(e) => set("lastName", e.target.value)} error={errors.lastName} />
          </div>

          <Input
            label="شماره موبایل"
            readOnly
            dir="ltr"
            className="[&_input]:text-start"
            value={user ? formatPhone(user.phone) : ""}
            hint="شماره موبایل شناسه ورود شماست و قابل تغییر نیست. برای تغییر با پشتیبانی تماس بگیرید."
          />

          <Input
            label="ایمیل"
            type="email"
            dir="ltr"
            className="[&_input]:text-start"
            autoComplete="email"
            placeholder="you@example.com"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            error={errors.email}
            hint="اختیاری — برای دریافت فاکتور و خبرنامه."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="کد ملی"
              inputMode="numeric"
              dir="ltr"
              className="[&_input]:text-start"
              value={values.nationalId}
              onChange={(e) => set("nationalId", e.target.value)}
              error={errors.nationalId}
              hint="اختیاری — برای صدور فاکتور رسمی."
            />
            <Input
              label="تاریخ تولد"
              type="date"
              dir="ltr"
              className="[&_input]:text-start"
              value={values.birthDate}
              onChange={(e) => set("birthDate", e.target.value)}
              hint="اختیاری — برای هدیه تولد."
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" loading={save.pending} disabled={save.pending}>ذخیره تغییرات</Button>
          </div>
        </form>
      </Card>

      {user && (
        <Alert tone="info" role="status">
          <span className="inline-flex items-center gap-1.5">
            <Info className="size-4" aria-hidden />
            حساب شما از {formatDate(user.createdAt)} در لوران فعال است.
          </span>
        </Alert>
      )}
    </div>
  );
}
