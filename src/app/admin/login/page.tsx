"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Feedback";
import { Logo } from "@/components/layout/Logo";
import { api, ApiClientError, errorMessage } from "@/lib/api/client";

/**
 * Administrator sign-in.
 *
 * Deliberately outside the `(dashboard)` route group so it renders without the
 * admin shell — and without needing a session to see it.
 */
function AdminLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") ?? "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;

    setError(null);
    setFieldErrors({});
    setPending(true);
    try {
      await api.post("/api/v1/admin/auth/login", { email, password });
      // A full navigation, so the server layout re-runs and picks up the cookie.
      router.replace(redirect);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.details) {
        setFieldErrors({
          email: err.fieldError("email"),
          password: err.fieldError("password"),
        });
      }
      setError(errorMessage(err));
      setPending(false);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo size="md" href="/" />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-fg-muted">
            <ShieldCheck className="size-3.5" aria-hidden />
            پنل مدیریت
          </span>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 sm:p-8">
          <h1 className="text-lg font-bold text-fg">ورود مدیر</h1>
          <p className="mt-2 text-sm leading-7 text-fg-muted">
            برای دسترسی به پنل مدیریت، ایمیل و رمز عبور خود را وارد کنید.
          </p>

          <form onSubmit={submit} noValidate className="mt-6 space-y-4" aria-busy={pending}>
            <Input
              label="ایمیل"
              type="email"
              dir="ltr"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              error={fieldErrors.email}
              disabled={pending}
            />
            <Input
              label="رمز عبور"
              type="password"
              dir="ltr"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              error={fieldErrors.password}
              disabled={pending}
            />

            {error && (
              <Alert tone="danger" role="alert">{error}</Alert>
            )}

            <Button type="submit" size="lg" fullWidth loading={pending} disabled={pending}>
              <LockKeyhole className="size-4" aria-hidden />
              ورود به پنل
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs leading-6 text-fg-subtle">
          این صفحه برای مدیر فروشگاه است. اگر مشتری هستید، از{" "}
          <a href="/auth/login" className="text-primary hover:underline">ورود مشتریان</a>{" "}
          استفاده کنید.
        </p>
      </div>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center"><div className="skeleton h-96 w-full max-w-sm rounded-xl" /></div>}>
      <AdminLoginForm />
    </Suspense>
  );
}
