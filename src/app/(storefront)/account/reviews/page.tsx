"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert, EmptyState, Skeleton } from "@/components/ui/Feedback";
import { Stars } from "@/components/ui/Rating";
import { api, errorMessage } from "@/lib/api/client";
import { formatDate, toPersianDigits } from "@/lib/format";

/** A review the customer wrote, including ones still awaiting moderation. */
interface MyReview {
  id: string;
  productId: string;
  productSlug: string;
  productName: string;
  rating: number;
  title?: string;
  body: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

/** A delivered purchase with no review yet. */
interface PendingReview {
  productId: string;
  name: string;
  image: string;
  slug: string;
  colorName: string;
  size: number;
  orderNumber: string;
  purchasedAt: string;
}

/** Moderation state, said plainly — a pending review is not lost. */
const STATUS_BADGE = {
  approved: { tone: "success" as const, label: "منتشر شده" },
  pending: { tone: "warning" as const, label: "در انتظار تأیید" },
  rejected: { tone: "neutral" as const, label: "تأیید نشد" },
};

/**
 * "My reviews".
 *
 * Split into what the customer has written and what they can still write —
 * delivered items with no review yet. That second list is the useful half.
 *
 * A review the customer wrote is shown whatever its moderation state, with the
 * state labelled: a pending review that simply vanished from this page would
 * look like it was never submitted.
 */
export default function MyReviewsPage() {
  const [reviewed, setReviewed] = useState<MyReview[] | null>(null);
  const [pending, setPending] = useState<PendingReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<{ reviews: MyReview[] }>("/api/v1/account/reviews"),
      api.get<{ pending: PendingReview[] }>("/api/v1/account/reviewable"),
    ])
      .then(([mine, awaiting]) => {
        if (cancelled) return;
        setReviewed(mine.reviews);
        setPending(awaiting.pending);
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(errorMessage(caught));
        setReviewed([]);
        setPending([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = reviewed === null || pending === null;
  const pendingList = pending ?? [];
  const reviewedList = reviewed ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-fg sm:text-2xl">دیدگاه‌های من</h1>
        <p className="mt-1.5 text-sm text-fg-muted">
          تجربه شما به بقیه کمک می‌کند سایز و کیفیت را بهتر انتخاب کنند.
        </p>
      </header>

      {error && <Alert tone="danger" role="alert">{error}</Alert>}

      <section aria-labelledby="pending-reviews">
        <h2 id="pending-reviews" className="mb-3 font-bold text-fg">
          در انتظار دیدگاه
          <span className="tnum ms-2 text-sm font-normal text-fg-muted">
            ({loading ? "…" : toPersianDigits(pendingList.length)})
          </span>
        </h2>

        {loading ? (
          <div className="space-y-3" role="status" aria-label="در حال بارگذاری">
            {[0, 1].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
          </div>
        ) : pendingList.length === 0 ? (
          <EmptyState
            icon={<Star className="size-7" aria-hidden />}
            title="کالایی در انتظار دیدگاه ندارید"
            description="پس از تحویل هر سفارش، می‌توانید درباره آن بنویسید."
            action={<ButtonLink href="/shop">دیدن محصولات</ButtonLink>}
          />
        ) : (
          <ul className="space-y-3">
            {pendingList.map((item) => (
              <li key={`${item.orderNumber}-${item.productId}`}>
                <Card className="flex flex-wrap items-center gap-4">
                  <Link href={`/product/${item.slug}`} className="relative size-16 shrink-0 overflow-hidden rounded-md bg-surface-inset">
                    <Image src={item.image} alt={item.name} fill sizes="64px" className="object-cover" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/product/${item.slug}`} className="line-clamp-1 text-sm font-medium text-fg hover:text-primary dark:hover:text-[color:var(--primary-soft-fg)]">
                      {item.name}
                    </Link>
                    <p className="tnum mt-1 text-xs text-fg-muted">
                      {item.colorName}، سایز {toPersianDigits(item.size)}، خرید در {formatDate(item.purchasedAt)}
                    </p>
                  </div>
                  <ButtonLink href={`/product/${item.slug}#reviews`} variant="secondary" size="sm" className="shrink-0">
                    ثبت دیدگاه
                  </ButtonLink>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="my-reviews">
        <h2 id="my-reviews" className="mb-3 font-bold text-fg">
          دیدگاه‌های ثبت‌شده
          <span className="tnum ms-2 text-sm font-normal text-fg-muted">
            ({loading ? "…" : toPersianDigits(reviewedList.length)})
          </span>
        </h2>

        {loading ? (
          <div className="space-y-3" role="status" aria-label="در حال بارگذاری">
            {[0, 1].map((i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
          </div>
        ) : reviewedList.length === 0 ? (
          <EmptyState
            icon={<Star className="size-7" aria-hidden />}
            title="هنوز دیدگاهی ننوشته‌اید"
            description="اولین دیدگاهتان را برای یکی از خریدهای تحویل‌شده بنویسید."
          />
        ) : (
          <ul className="space-y-3">
            {reviewedList.map((review) => {
              const badge = STATUS_BADGE[review.status];
              return (
                <li key={review.id}>
                  <Card>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link
                          href={`/product/${review.productSlug}`}
                          className="line-clamp-1 text-sm font-medium text-fg hover:text-primary dark:hover:text-[color:var(--primary-soft-fg)]"
                        >
                          {review.productName}
                        </Link>
                        <Badge tone={badge.tone} size="sm">{badge.label}</Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Stars value={review.rating} size="sm" />
                        <span className="text-xs text-fg-subtle">{formatDate(review.createdAt)}</span>
                      </div>
                      {review.title && <p className="mt-2 text-sm font-medium text-fg">{review.title}</p>}
                      <p className="mt-2 text-sm leading-7 text-fg-muted">{review.body}</p>
                      {review.status === "pending" && (
                        <p className="mt-2 text-xs text-fg-subtle">
                          دیدگاه شما ثبت شده و پس از بررسی توسط لوران منتشر می‌شود.
                        </p>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
