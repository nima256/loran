import { Suspense } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import {
  AdminFilterChips,
  AdminPagination,
  AdminResultCount,
  AdminSearch,
} from "@/components/admin/AdminTableControls";
import { ReturnDecisionButton } from "@/components/admin/ModerationActions";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Feedback";
import { PriceInline } from "@/components/ui/Price";
import { getAdminReturn, listAdminReturns } from "@/server/services/returns";
import { paginationSchema } from "@/server/lib/validation";
import { formatDate, formatPhone, toPersianDigits } from "@/lib/format";
import { z } from "zod";

/**
 * Return and exchange requests.
 *
 * The status workflow is enforced server-side, so only the transitions that
 * make sense from a request's current state are offered. Marking a request
 * `received` returns its goods to stock in the same transaction.
 */

export const dynamic = "force-dynamic";

const filterSchema = paginationSchema.extend({
  q: z.string().max(120).optional(),
  status: z
    .enum([
      "requested", "info_requested", "approved", "rejected",
      "in_transit", "received", "completed", "refunded", "cancelled",
    ])
    .optional(),
  type: z.enum(["return", "exchange"]).optional(),
});

const STATUS_TONE: Record<string, "warning" | "info" | "success" | "danger" | "neutral"> = {
  requested: "warning",
  info_requested: "warning",
  approved: "info",
  in_transit: "info",
  received: "info",
  completed: "success",
  refunded: "success",
  rejected: "danger",
  cancelled: "neutral",
};

export default async function AdminReturnsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") flat[key] = value;
  }
  const filters = filterSchema.parse(flat);
  const result = await listAdminReturns(filters);

  // The full row is needed for the note the decision modal starts from.
  const details = await Promise.all(
    result.items.map((item) => getAdminReturn(item.id).catch(() => null))
  );

  return (
    <>
      <AdminPageHeader
        title="مرجوعی و تعویض"
        description="درخواست‌های مشتریان و روند رسیدگی به آن‌ها."
      />

      <Card className="mb-4 space-y-3">
        <Suspense fallback={<div className="skeleton h-11 rounded-md" />}>
          <AdminSearch placeholder="شماره درخواست، شماره سفارش یا موبایل مشتری" />
        </Suspense>
        <Suspense fallback={null}>
          <AdminFilterChips
            param="status"
            options={[
              { value: "", label: "همه" },
              { value: "requested", label: "ثبت شده" },
              { value: "approved", label: "تأیید شده" },
              { value: "in_transit", label: "در مسیر بازگشت" },
              { value: "received", label: "دریافت شد" },
              { value: "completed", label: "تکمیل شده" },
              { value: "rejected", label: "رد شده" },
            ]}
          />
        </Suspense>
        <Suspense fallback={null}>
          <AdminFilterChips
            param="type"
            options={[
              { value: "", label: "همه انواع" },
              { value: "return", label: "مرجوعی" },
              { value: "exchange", label: "تعویض" },
            ]}
          />
        </Suspense>
      </Card>

      <div className="mb-3">
        <AdminResultCount
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          noun="درخواست"
        />
      </div>

      {result.items.length === 0 ? (
        <EmptyState
          icon={<RotateCcw className="size-7" aria-hidden />}
          title="درخواستی در این وضعیت نیست"
          description="درخواست‌های مرجوعی و تعویض مشتریان اینجا نمایش داده می‌شوند."
        />
      ) : (
        <ul className="space-y-3">
          {result.items.map((request, index) => {
            const detail = details[index];
            return (
              <li key={request.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-fg">
                        {request.type === "return" ? "مرجوعی" : "تعویض"}
                        <span className="tnum text-sm font-normal text-fg-muted" dir="ltr">
                          {request.number}
                        </span>
                        <Link
                          href={`/admin/orders/${request.orderNumber}`}
                          className="tnum text-sm text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]"
                          dir="ltr"
                        >
                          {request.orderNumber}
                        </Link>
                      </p>
                      <p className="tnum mt-1 text-xs text-fg-muted">
                        {request.customerName} — <span dir="ltr">{formatPhone(request.customerPhone)}</span>{" "}
                        — {formatDate(request.createdAt)}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[request.status] ?? "neutral"} size="sm">
                      {request.statusLabel}
                    </Badge>
                  </div>

                  <dl className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-fg-muted">دلیل</dt>
                      <dd className="text-end text-fg">{request.reason}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-fg-muted">کالاها</dt>
                      <dd className="tnum text-end text-fg">
                        {detail?.items
                          .map((i) => `${i.name} (${i.colorName}، ${toPersianDigits(i.size)}) × ${toPersianDigits(i.quantity)}`)
                          .join("، ") ?? `${toPersianDigits(request.itemCount)} قلم`}
                      </dd>
                    </div>
                    {request.refundAmount > 0 && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-fg-muted">مبلغ بازگشتی</dt>
                        <dd><PriceInline value={request.refundAmount} /></dd>
                      </div>
                    )}
                    {detail?.customerNote && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-fg-muted">توضیح مشتری</dt>
                        <dd className="text-end text-fg">{detail.customerNote}</dd>
                      </div>
                    )}
                    {detail?.customer && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-fg-muted">نشانی</dt>
                        <dd className="text-end text-fg-muted">{detail.customer.address}</dd>
                      </div>
                    )}
                  </dl>

                  {detail && detail.timeline.length > 1 && (
                    <ol className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-fg-muted">
                      {detail.timeline.map((entry, i) => (
                        <li key={`${entry.status}-${i}`} className="flex flex-wrap justify-between gap-2">
                          <span className="text-fg">
                            {entry.label}{entry.note ? ` — ${entry.note}` : ""}
                          </span>
                          <span className="tnum">{formatDate(entry.at)}</span>
                        </li>
                      ))}
                    </ol>
                  )}

                  <div className="mt-4 border-t border-border pt-3">
                    <ReturnDecisionButton
                      requestId={request.id}
                      status={request.status}
                      adminNote={detail?.adminNote}
                    />
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
