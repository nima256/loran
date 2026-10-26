import type { Metadata } from "next";
import Link from "next/link";
import { RotateCcw, ShoppingBag, XCircle } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { toPersianDigits } from "@/lib/format";

export const metadata: Metadata = { title: "پرداخت ناموفق", robots: { index: false } };

const REASONS: Record<string, string> = {
  cancelled: "پرداخت توسط شما لغو شد.",
  insufficient: "موجودی حساب برای این پرداخت کافی نبود.",
  timeout: "مهلت پرداخت در درگاه بانکی به پایان رسید.",
  unknown: "پرداخت به دلیل خطای درگاه بانکی کامل نشد.",
};

export default async function PaymentFailedPage({
  searchParams,
}: { searchParams: Promise<{ order?: string; reason?: string }> }) {
  const { order, reason = "unknown" } = await searchParams;

  return (
    <div className="container-narrow py-12">
      <div className="rounded-xl border border-danger/30 bg-surface p-6 text-center sm:p-10">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-danger-soft text-danger">
          <XCircle className="size-9" aria-hidden />
        </span>
        <h1 className="mt-5 text-2xl font-bold text-fg">پرداخت انجام نشد</h1>
        <p className="mt-3 text-sm leading-8 text-fg-muted">
          {REASONS[reason] ?? REASONS.unknown} سبد خرید شما دست‌نخورده باقی مانده و می‌توانید دوباره تلاش کنید.
        </p>

        {order && (
          <p className="tnum mt-4 text-sm text-fg-muted">
            شماره سفارش: <span className="break-token font-bold text-fg" dir="ltr">{order}</span>
          </p>
        )}

        <Alert tone="info" className="mt-6 text-start" title="اگر مبلغ از حساب شما کسر شده است">
          در صورت کسر وجه، مبلغ حداکثر تا ۷۲ ساعت کاری به‌صورت خودکار توسط بانک بازگردانده می‌شود.
          اگر بعد از این مدت مبلغ برنگشت، با شماره رهگیری بانکی با پشتیبانی تماس بگیرید.
        </Alert>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="/checkout" icon={<RotateCcw className="size-4" aria-hidden />}>
            تلاش دوباره برای پرداخت
          </ButtonLink>
          <ButtonLink href="/cart" variant="secondary" icon={<ShoppingBag className="size-4" aria-hidden />}>
            بازگشت به سبد خرید
          </ButtonLink>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-fg-muted">
        مشکل ادامه دارد؟{" "}
        <Link href="/contact" className="text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]">
          با ما در تماس باشید
        </Link>{" "}
        — کد خطا: <span className="tnum" dir="ltr">{toPersianDigits("۵۰۲")}</span>
      </p>
    </div>
  );
}
