"use client";

import { useMemo, useState } from "react";
import { MessageSquarePlus, ShieldCheck, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Overlay";
import { Alert, EmptyState } from "@/components/ui/Feedback";
import { Stars, StarPicker } from "@/components/ui/Rating";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/store/AuthProvider";
import { api } from "@/lib/api/client";
import { useAction } from "@/lib/use-action";
import { formatRelative, toPersianDigits } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RatingBreakdown, Review } from "@/types";

const SIZE_FEEDBACK_LABELS = { small: "کوچک‌تر از سایز", true: "اندازه سایز", large: "بزرگ‌تر از سایز" } as const;

/**
 * Reviews and ratings.
 *
 * Submitting requires a signed-in account — that is the rule once the backend
 * lands, so the UI enforces it now rather than pretending otherwise.
 */
export function Reviews({
  productId, productName, reviews, breakdown, fallbackRating,
}: {
  productId: string;
  productName: string;
  reviews: Review[];
  breakdown: RatingBreakdown;
  fallbackRating: number;
}) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [sort, setSort] = useState<"newest" | "helpful" | "highest" | "lowest">("newest");

  // Only published reviews are listed. A review the customer just submitted is
  // pending moderation and lives in their account area, not here.
  const all = reviews;
  const sorted = useMemo(() => {
    const copy = [...all];
    if (sort === "helpful") return copy.sort((a, b) => b.helpfulCount - a.helpfulCount);
    if (sort === "highest") return copy.sort((a, b) => b.rating - a.rating);
    if (sort === "lowest") return copy.sort((a, b) => a.rating - b.rating);
    return copy.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [all, sort]);

  const average = breakdown.total > 0 ? breakdown.average : fallbackRating;
  const sizeTotal = breakdown.sizeFeedback.small + breakdown.sizeFeedback.true + breakdown.sizeFeedback.large;

  /**
   * A submitted review is `pending` until an administrator approves it, so it
   * is deliberately NOT spliced into the public list — showing the customer
   * their own review among the published ones would misrepresent what everyone
   * else can see. The confirmation says where it went instead.
   */
  const onSubmitted = () => {
    setFormOpen(false);
    toast({
      tone: "success",
      title: "دیدگاه شما ثبت شد",
      description: "پس از بررسی توسط تیم لوران روی صفحه محصول نمایش داده می‌شود.",
    });
  };

  return (
    <section id="reviews" aria-labelledby="reviews-title" className="scroll-mt-24">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="reviews-title" className="text-xl font-bold text-fg sm:text-2xl">دیدگاه خریداران</h2>
          <p className="mt-1.5 text-sm text-fg-muted">
            {breakdown.total > 0
              ? `${toPersianDigits(breakdown.total)} دیدگاه ثبت‌شده برای این محصول`
              : "اولین نفری باشید که درباره این کفش می‌نویسد."}
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => setFormOpen(true)}
          icon={<MessageSquarePlus className="size-4" aria-hidden />}
        >
          ثبت دیدگاه
        </Button>
      </div>

      {breakdown.total > 0 && (
        <div className="mb-8 grid gap-6 rounded-lg border border-border bg-surface p-5 sm:grid-cols-[auto_1fr] sm:gap-10">
          <div className="text-center sm:text-start">
            <p className="tnum text-4xl font-bold text-fg">{toPersianDigits(average.toFixed(1))}</p>
            <Stars value={average} size="lg" className="mt-2 justify-center sm:justify-start" />
            <p className="tnum mt-2 text-sm text-fg-muted">از {toPersianDigits(breakdown.total)} دیدگاه</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              {([5, 4, 3, 2, 1] as const).map((star) => {
                const count = breakdown.distribution[star];
                const percent = breakdown.total ? (count / breakdown.total) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-3">
                    <span className="tnum w-10 shrink-0 text-xs text-fg-muted">{toPersianDigits(star)} ستاره</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <span className="block h-full rounded-full bg-[#D9A441]" style={{ width: `${percent}%` }} />
                    </span>
                    <span className="tnum w-8 shrink-0 text-start text-xs text-fg-subtle">{toPersianDigits(count)}</span>
                  </div>
                );
              })}
            </div>

            {sizeTotal > 0 && (
              <div className="rounded-md bg-surface-2 p-3">
                <p className="mb-2 text-xs font-medium text-fg">نظر خریداران درباره سایز</p>
                <div className="flex h-2 overflow-hidden rounded-full">
                  <span className="bg-warning" style={{ width: `${(breakdown.sizeFeedback.small / sizeTotal) * 100}%` }} />
                  <span className="bg-success" style={{ width: `${(breakdown.sizeFeedback.true / sizeTotal) * 100}%` }} />
                  <span className="bg-info" style={{ width: `${(breakdown.sizeFeedback.large / sizeTotal) * 100}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-fg-muted">
                  <span>کوچک ({toPersianDigits(breakdown.sizeFeedback.small)})</span>
                  <span>اندازه ({toPersianDigits(breakdown.sizeFeedback.true)})</span>
                  <span>بزرگ ({toPersianDigits(breakdown.sizeFeedback.large)})</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState
          icon={<MessageSquarePlus className="size-7" aria-hidden />}
          title="هنوز دیدگاهی ثبت نشده است"
          description="اگر این کفش را خریده‌اید، تجربه‌تان به بقیه کمک می‌کند سایز و کیفیت را بهتر بسنجند."
          action={<Button onClick={() => setFormOpen(true)}>اولین دیدگاه را بنویسید</Button>}
        />
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2">
            <label htmlFor="review-sort" className="text-sm text-fg-muted">مرتب‌سازی</label>
            <select
              id="review-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="h-11 rounded-md border border-border bg-surface px-3 pe-8 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            >
              <option value="newest">جدیدترین</option>
              <option value="helpful">مفیدترین</option>
              <option value="highest">بیشترین امتیاز</option>
              <option value="lowest">کمترین امتیاز</option>
            </select>
          </div>

          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {sorted.map((review) => (
              <li key={review.id} className="p-5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-3 text-sm font-bold text-fg-muted">
                    {review.authorName.trim().charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
                      {review.authorName}
                      {review.verifiedPurchase && (
                        <Badge tone="success" size="sm" icon={<ShieldCheck className="size-3" aria-hidden />}>
                          خرید تأییدشده
                        </Badge>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-fg-subtle">{formatRelative(review.createdAt)}</p>
                  </div>
                  <Stars value={review.rating} size="sm" />
                </div>

                {review.title && <p className="mt-3 font-semibold text-fg">{review.title}</p>}
                <p className="mt-2 text-sm leading-8 text-fg-muted">{review.body}</p>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-fg-subtle">
                  {review.purchasedVariant && (
                    <span className="tnum">
                      خریداری‌شده: {review.purchasedVariant.colorName}، سایز {toPersianDigits(review.purchasedVariant.size)}
                    </span>
                  )}
                  {review.sizeFeedback && (
                    <span className={cn(review.sizeFeedback !== "true" && "text-warning")}>
                      سایز: {SIZE_FEEDBACK_LABELS[review.sizeFeedback]}
                    </span>
                  )}
                  <span className="tnum inline-flex items-center gap-1">
                    <ThumbsUp className="size-3.5" aria-hidden />
                    {toPersianDigits(review.helpfulCount)} نفر مفید دانستند
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <ReviewFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        productId={productId}
        productName={productName}
        isAuthenticated={isAuthenticated}
        onSubmitted={onSubmitted}
      />
    </section>
  );
}

function ReviewFormModal({
  open, onClose, productId, productName, isAuthenticated, onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  isAuthenticated: boolean;
  onSubmitted: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sizeFeedback, setSizeFeedback] = useState<"small" | "true" | "large">("true");
  const [errors, setErrors] = useState<{ rating?: string; body?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  /**
   * Submits for moderation.
   *
   * `verifiedPurchase` is decided by the server from the order history — it is
   * not something the form can claim.
   */
  const send = useAction(
    async () =>
      api.post("/api/v1/reviews", {
        productId,
        rating,
        title: title.trim() || undefined,
        body: body.trim(),
        sizeFeedback,
      }),
    {
      onSuccess: () => {
        setRating(0);
        setTitle("");
        setBody("");
        setSizeFeedback("true");
        setSubmitError(null);
        onSubmitted();
      },
      onError: (message) => setSubmitError(message),
    }
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (rating === 0) next.rating = "لطفاً امتیاز خود را انتخاب کنید.";
    if (body.trim().length < 10) next.body = "متن دیدگاه باید دست‌کم ۱۰ حرف باشد.";
    setErrors(next);
    if (Object.keys(next).length) return;

    void send.run();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="ثبت دیدگاه"
      description={productName}
      size="lg"
      footer={
        isAuthenticated ? (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={send.pending}>انصراف</Button>
            <Button type="submit" form="review-form" loading={send.pending} disabled={send.pending}>
              ثبت دیدگاه
            </Button>
          </div>
        ) : null
      }
    >
      {!isAuthenticated ? (
        <Alert tone="brand" title="برای ثبت دیدگاه وارد شوید">
          دیدگاه‌ها به حساب کاربری شما متصل می‌شوند تا خریداران واقعی مشخص باشند.
          <div className="mt-3">
            <Button onClick={() => { onClose(); window.location.href = "/auth/login"; }}>
              ورود با شماره موبایل
            </Button>
          </div>
        </Alert>
      ) : (
        <form id="review-form" onSubmit={submit} noValidate className="space-y-5" aria-busy={send.pending}>
          {submitError && <Alert tone="danger" role="alert">{submitError}</Alert>}
          <div>
            <span id="rating-label" className="mb-2 block text-sm font-medium text-fg">
              امتیاز شما <span className="text-primary" aria-hidden>*</span>
            </span>
            <StarPicker value={rating} onChange={(v) => { setRating(v); setErrors((e) => ({ ...e, rating: undefined })); }} error={!!errors.rating} />
            {errors.rating && <p role="alert" className="mt-1.5 text-sm text-danger">{errors.rating}</p>}
          </div>

          <Input
            label="عنوان دیدگاه"
            hint="اختیاری — مثلاً «راحت و سبک»"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
          />

          <Textarea
            label="متن دیدگاه"
            required
            rows={5}
            value={body}
            onChange={(e) => { setBody(e.target.value); setErrors((err) => ({ ...err, body: undefined })); }}
            error={errors.body}
            hint="درباره راحتی، کیفیت دوخت و اندازه بودن سایز بنویسید."
            placeholder="تجربه‌تان از این کفش را بنویسید…"
          />

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-fg">سایز این کفش چطور بود؟</legend>
            <div className="flex flex-wrap gap-2">
              {(["small", "true", "large"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSizeFeedback(value)}
                  aria-pressed={sizeFeedback === value}
                  className={cn(
                    "h-11 rounded-md border px-4 text-sm transition-colors",
                    sizeFeedback === value
                      ? "border-primary bg-primary text-primary-fg"
                      : "border-border bg-surface text-fg-muted hover:text-fg"
                  )}
                >
                  {SIZE_FEEDBACK_LABELS[value]}
                </button>
              ))}
            </div>
          </fieldset>

          <p className="text-xs leading-6 text-fg-subtle">
            دیدگاه شما با نام حساب کاربری‌تان ثبت می‌شود و پس از بررسی منتشر می‌گردد.
          </p>
        </form>
      )}
    </Modal>
  );
}
