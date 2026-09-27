import { Suspense } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import {
  AdminFilterChips,
  AdminPagination,
  AdminResultCount,
  AdminSearch,
} from "@/components/admin/AdminTableControls";
import { ReviewModerationButtons } from "@/components/admin/ModerationActions";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Feedback";
import { Stars } from "@/components/ui/Rating";
import { prisma } from "@/server/lib/prisma";
import { paginated, paginationArgs, paginationSchema } from "@/server/lib/validation";
import { formatDate, formatPhone, toPersianDigits } from "@/lib/format";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

/**
 * Review moderation.
 *
 * A new review is `pending` and invisible to the storefront until approved.
 * Only approved reviews count towards a product's rating, and every moderation
 * recomputes that aggregate — so un-approving a published review takes the
 * numbers back down.
 */

export const dynamic = "force-dynamic";

const filterSchema = paginationSchema.extend({
  q: z.string().max(120).optional(),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
});

const STATUS_BADGE = {
  pending: { tone: "warning" as const, label: "در انتظار بررسی" },
  approved: { tone: "success" as const, label: "منتشر شده" },
  rejected: { tone: "neutral" as const, label: "رد شده" },
};

const SIZE_FEEDBACK_LABELS: Record<string, string> = {
  small: "کوچک‌تر از سایز",
  true_to_size: "اندازه سایز",
  large: "بزرگ‌تر از سایز",
};

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") flat[key] = value;
  }
  // Default to the queue that needs work.
  const filters = filterSchema.parse({ status: flat.status ?? "pending", ...flat });

  const where: Prisma.ReviewWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { authorName: { contains: q, mode: "insensitive" } },
      { body: { contains: q, mode: "insensitive" } },
      { product: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [total, rows, counts] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      orderBy: filters.status === "pending" ? { createdAt: "asc" } : { createdAt: "desc" },
      include: {
        product: { select: { name: true, slug: true, rating: true, reviewCount: true } },
        customer: { select: { id: true, phone: true, firstName: true, lastName: true } },
      },
      ...paginationArgs(filters),
    }),
    prisma.review.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const countByStatus = new Map(counts.map((c) => [c.status as string, c._count._all]));
  const result = paginated(rows, total, filters);

  return (
    <>
      <AdminPageHeader
        title="دیدگاه‌ها"
        description="دیدگاه‌های جدید پس از تأیید شما در فروشگاه منتشر می‌شوند."
      />

      <Card className="mb-4 space-y-3">
        <Suspense fallback={<div className="skeleton h-11 rounded-md" />}>
          <AdminSearch placeholder="نام نویسنده، متن دیدگاه یا نام محصول" />
        </Suspense>
        <Suspense fallback={null}>
          <AdminFilterChips
            param="status"
            options={[
              { value: "pending", label: "در انتظار بررسی", count: countByStatus.get("pending") ?? 0 },
              { value: "approved", label: "منتشر شده", count: countByStatus.get("approved") ?? 0 },
              { value: "rejected", label: "رد شده", count: countByStatus.get("rejected") ?? 0 },
            ]}
          />
        </Suspense>
      </Card>

      <div className="mb-3">
        <AdminResultCount
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          noun="دیدگاه"
        />
      </div>

      {result.items.length === 0 ? (
        <EmptyState
          icon={<Star className="size-7" aria-hidden />}
          title="دیدگاهی در این وضعیت نیست"
          description="دیدگاه‌های تازه مشتریان اینجا برای بررسی نمایش داده می‌شوند."
        />
      ) : (
        <ul className="space-y-3">
          {result.items.map((review) => {
            const badge = STATUS_BADGE[review.status];
            return (
              <li key={review.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/product/${review.product.slug}`}
                        className="font-medium text-fg hover:text-primary dark:hover:text-[color:var(--primary-soft-fg)]"
                      >
                        {review.product.name}
                      </Link>
                      <p className="tnum mt-1 text-xs text-fg-subtle">
                        امتیاز فعلی محصول: {toPersianDigits(review.product.rating.toFixed(1))} از{" "}
                        {toPersianDigits(review.product.reviewCount)} دیدگاه منتشرشده
                      </p>
                    </div>
                    <Badge tone={badge.tone} size="sm">{badge.label}</Badge>
                  </div>

                  <div className="mt-4 rounded-lg bg-surface-2 p-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Stars value={review.rating} size="sm" />
                      <span className="text-sm font-medium text-fg">{review.authorName}</span>
                      {review.verifiedPurchase && (
                        <Badge tone="success" size="sm">خرید تأییدشده</Badge>
                      )}
                      <span className="text-xs text-fg-subtle">{formatDate(review.createdAt.toISOString())}</span>
                    </div>

                    {review.title && (
                      <p className="mt-2 text-sm font-medium text-fg">{review.title}</p>
                    )}
                    <p className="mt-1.5 text-sm leading-7 text-fg-muted">{review.body}</p>

                    <p className="tnum mt-2 flex flex-wrap gap-x-3 text-xs text-fg-subtle">
                      {review.purchasedColorName && review.purchasedSize != null && (
                        <span>
                          خرید: {review.purchasedColorName}، سایز {toPersianDigits(review.purchasedSize)}
                        </span>
                      )}
                      {review.sizeFeedback && (
                        <span>سایزبندی: {SIZE_FEEDBACK_LABELS[review.sizeFeedback]}</span>
                      )}
                      {review.customer && (
                        <Link
                          href={`/admin/customers/${review.customer.id}`}
                          className="text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]"
                          dir="ltr"
                        >
                          {formatPhone(review.customer.phone)}
                        </Link>
                      )}
                    </p>
                  </div>

                  <div className="mt-4">
                    <ReviewModerationButtons reviewId={review.id} status={review.status} />
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Suspense fallback={null}>
        <AdminPagination page={result.page} totalPages={result.totalPages} className="mt-6" />
      </Suspense>
    </>
  );
}
