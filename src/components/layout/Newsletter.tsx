"use client";

import { useState } from "react";
import { Check, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { isValidEmail } from "@/lib/format";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type State = "idle" | "loading" | "success" | "error" | "duplicate";

/**
 * Newsletter sign-up. Lives in the footer — deliberately no interstitial popup.
 *
 * ▶ Backend swap: `submit` becomes `POST /newsletter`. The four visual states
 *   below already cover what that endpoint can answer.
 */
export function NewsletterForm({ className, variant = "footer" }: { className?: string; variant?: "footer" | "panel" }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidEmail(email)) {
      setState("error");
      return;
    }
    setState("loading");
    try {
      const result = await api.post<{ created: boolean; resubscribed: boolean }>(
        "/api/v1/newsletter",
        { email: email.trim(), source: "footer" }
      );
      // An address that was already on the list is a success, not an error —
      // the only thing that changes is what the visitor is told.
      setState(result.created || result.resubscribed ? "success" : "duplicate");
    } catch {
      setState("error");
    }
  };

  if (state === "success") {
    return (
      <div className={cn("flex items-start gap-3 rounded-lg border border-success/30 bg-success-soft p-4", className)}>
        <Check className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
        <div>
          <p className="font-semibold text-fg">عضویت شما ثبت شد</p>
          <p className="mt-1 text-sm leading-7 text-fg-muted">
            از این پس جدیدترین مدل‌ها و تخفیف‌های لوران را زودتر از بقیه دریافت می‌کنید.
          </p>
        </div>
      </div>
    );
  }

  const invalid = state === "error" || state === "duplicate";

  return (
    <form onSubmit={submit} noValidate className={className}>
      {variant === "panel" && (
        <>
          <h3 className="text-lg font-bold text-fg">از تخفیف‌ها جا نمانید</h3>
          <p className="mt-1.5 text-sm leading-7 text-fg-muted">
            ایمیل خود را بنویسید تا مدل‌های تازه و حراج‌های لوران را زودتر ببینید.
          </p>
        </>
      )}
      <label htmlFor="newsletter-email" className="mt-4 block text-sm font-medium text-fg">
        ایمیل شما
      </label>
      <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Mail className="pointer-events-none absolute inset-y-0 start-4 my-auto size-4 text-fg-subtle" aria-hidden />
          <input
            id="newsletter-email"
            type="email"
            dir="ltr"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (invalid) setState("idle"); }}
            placeholder="you@example.com"
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? "newsletter-error" : undefined}
            className={cn(
              "h-12 w-full rounded-md border bg-surface px-4 ps-11 text-start text-base text-fg",
              "placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-primary/25",
              invalid ? "border-danger focus:border-danger" : "border-border-strong focus:border-primary"
            )}
          />
        </div>
        <Button type="submit" loading={state === "loading"} className="sm:w-auto">
          عضویت
        </Button>
      </div>
      {state === "error" && (
        <p id="newsletter-error" role="alert" className="mt-2 text-sm text-danger">
          ایمیل واردشده معتبر نیست. نمونه درست: name@example.com
        </p>
      )}
      {state === "duplicate" && (
        <p id="newsletter-error" role="alert" className="mt-2 text-sm text-warning">
          این ایمیل قبلاً در خبرنامه لوران ثبت شده است.
        </p>
      )}
      {state === "idle" && (
        <p className="mt-2 text-xs leading-6 text-fg-subtle">
          هر زمان بخواهید می‌توانید لغو عضویت کنید. ایمیل شما در اختیار کسی قرار نمی‌گیرد.
        </p>
      )}
    </form>
  );
}
