"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Home, RotateCcw, WifiOff } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { Breadcrumbs } from "@/components/ui/Navigation";

/**
 * Network-error state.
 *
 * Also the page a service worker would serve when the device is offline, so the
 * design exists before that is wired up. It reports the live connection status
 * rather than assuming the user is still offline.
 */
export default function OfflinePage() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <div className="container-page py-8">
      <Breadcrumbs className="mb-6" items={[{ label: "خانه", href: "/" }, { label: "خطای اتصال" }]} />

      <div className="mx-auto max-w-lg rounded-xl border border-border bg-surface p-8 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-warning-soft text-warning">
          <WifiOff className="size-8" aria-hidden />
        </span>

        <h1 className="mt-5 text-xl font-bold text-fg">اتصال اینترنت برقرار نیست</h1>
        <p className="mt-3 text-sm leading-8 text-fg-muted">
          نتوانستیم به سرورهای لوران وصل شویم. اتصال اینترنت دستگاهتان را بررسی کنید و دوباره
          تلاش کنید. سبد خرید شما روی همین دستگاه ذخیره شده و از بین نمی‌رود.
        </p>

        <Alert tone={online ? "success" : "warning"} role="status" className="mt-5 text-start">
          {online
            ? "اتصال اینترنت برقرار شد. می‌توانید صفحه را دوباره بارگذاری کنید."
            : "دستگاه شما همچنان آفلاین است."}
        </Alert>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={() => window.location.reload()} icon={<RotateCcw className="size-4" aria-hidden />}>
            تلاش دوباره
          </Button>
          <ButtonLink href="/" variant="secondary" icon={<Home className="size-4" aria-hidden />}>
            صفحه اصلی
          </ButtonLink>
        </div>

        <p className="mt-6 text-xs text-fg-subtle">
          اگر اینترنت شما وصل است ولی سایت باز نمی‌شود،{" "}
          <Link href="/contact" className="text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]">
            به ما اطلاع دهید
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
