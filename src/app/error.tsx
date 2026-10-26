"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, RotateCcw, TriangleAlert } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/layout/Logo";
import { siteConfig } from "@/lib/site-config";

/** Root error boundary — the last line of defence for an unexpected failure. */
export default function GlobalError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // ▶ Wire this up to the error tracker (Sentry et al.) when one is added.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-16 text-center">
      <Link href="/" className="rounded-md" aria-label="لوران — صفحه اصلی">
        <Logo size="lg" href={null} />
      </Link>

      <span className="mt-10 grid size-16 place-items-center rounded-full bg-danger-soft text-danger">
        <TriangleAlert className="size-8" aria-hidden />
      </span>

      <h1 className="mt-5 text-xl font-bold text-fg sm:text-2xl">مشکلی پیش آمد</h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-8 text-fg-muted">
        در بارگذاری این صفحه خطایی رخ داد. لطفاً دوباره تلاش کنید؛ اگر مشکل ادامه داشت با
        پشتیبانی لوران تماس بگیرید.
      </p>

      {error.digest && (
        <p className="tnum mt-3 text-xs text-fg-subtle" dir="ltr">کد خطا: {error.digest}</p>
      )}

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset} icon={<RotateCcw className="size-4" aria-hidden />}>تلاش دوباره</Button>
        <ButtonLink href="/" variant="secondary" icon={<Home className="size-4" aria-hidden />}>صفحه اصلی</ButtonLink>
      </div>

      <p className="mt-8 text-sm text-fg-muted">
        پشتیبانی:{" "}
        <a href={`tel:${siteConfig.contact.supportPhoneRaw}`} className="tnum text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]" dir="ltr">
          {siteConfig.contact.supportPhone}
        </a>
      </p>
    </div>
  );
}
