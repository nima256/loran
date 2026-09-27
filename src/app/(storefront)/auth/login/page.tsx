"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { useAuth } from "@/store/AuthProvider";
import { isValidPhone, toLatinDigits } from "@/lib/format";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/utils";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { requestOtp } = useAuth();
  const redirect = params.get("redirect") ?? "/account";

  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = toLatinDigits(phone).replace(/\s/g, "");
    if (!normalized) {
      setError("شماره موبایل را وارد کنید.");
      return;
    }
    if (!isValidPhone(normalized)) {
      setError("شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود. مثال: ۰۹۱۲۳۴۵۶۷۸۹");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await requestOtp(normalized);
      router.push(`/auth/verify?redirect=${encodeURIComponent(redirect)}`);
    } catch (err) {
      // The button must come back so the customer can retry — a rate limit or
      // an SMS provider outage is recoverable.
      setError(errorMessage(err));
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-6 sm:p-8">
      <h1 className="text-xl font-bold text-fg">ورود یا ثبت‌نام</h1>
      <p className="mt-2 text-sm leading-7 text-fg-muted">
        شماره موبایل خود را وارد کنید. کد تأیید برای شما پیامک می‌شود.
      </p>

      <form onSubmit={submit} noValidate className="mt-6" aria-busy={loading}>
        <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-fg">
          شماره موبایل <span className="text-primary" aria-hidden>*</span>
        </label>
        <div className="relative">
          <Smartphone className="pointer-events-none absolute inset-y-0 start-4 my-auto size-4 text-fg-subtle" aria-hidden />
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setError(null); }}
            disabled={loading}
            placeholder="09123456789"
            aria-invalid={!!error || undefined}
            aria-describedby={error ? "phone-error" : "phone-hint"}
            className={cn(
              "tnum h-12 w-full rounded-md border bg-surface px-4 ps-11 text-start text-base tracking-wide text-fg",
              "placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-primary/25",
              error ? "border-danger focus:border-danger" : "border-border-strong focus:border-primary"
            )}
          />
        </div>
        {error ? (
          <p id="phone-error" role="alert" className="mt-1.5 text-sm text-danger">{error}</p>
        ) : (
          <p id="phone-hint" className="mt-1.5 text-sm text-fg-muted">
            برای ثبت سفارش، ورود به حساب کاربری الزامی است.
          </p>
        )}

        <Button type="submit" size="lg" fullWidth loading={loading} disabled={loading} className="mt-5">
          دریافت کد تأیید
        </Button>
      </form>

      <Alert tone="info" className="mt-6">
        با ورود به لوران،{" "}
        <a href="/terms" className="font-medium text-primary hover:underline">قوانین و مقررات</a>{" "}
        و{" "}
        <a href="/privacy" className="font-medium text-primary hover:underline">حریم خصوصی</a>{" "}
        را می‌پذیرید.
      </Alert>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="h-72 skeleton rounded-xl" />}>
      <LoginForm />
    </Suspense>
  );
}
