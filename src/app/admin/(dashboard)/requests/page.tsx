import { Suspense } from "react";
import { Mail, MessageSquare, Users } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminFilterChips, AdminSearch } from "@/components/admin/AdminTableControls";
import { RequestStatusButton } from "@/components/admin/ModerationActions";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Feedback";
import { RequestTabs } from "@/components/admin/RequestTabs";
import {
  listConsultations,
  listContactMessages,
  listNewsletterSubscribers,
} from "@/server/services/submissions";
import { requestFilterSchema } from "@/server/schemas/admin";
import { formatDate, formatPhone, toPersianDigits } from "@/lib/format";

/**
 * Storefront submissions: size consultations, contact messages and newsletter
 * subscribers.
 *
 * All three used to report success from a `setTimeout`. They now persist, and
 * each has a status the store can actually work through.
 */

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "warning" | "info" | "success" | "neutral"> = {
  new: "warning",
  in_progress: "info",
  contacted: "info",
  completed: "success",
  cancelled: "neutral",
};

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") flat[key] = value;
  }

  const tab = flat.tab ?? "consultations";
  const filters = requestFilterSchema.parse({ ...flat, pageSize: "50" });

  const [consultations, messages, subscribers] = await Promise.all([
    listConsultations(filters),
    listContactMessages(filters),
    listNewsletterSubscribers({ page: 1, pageSize: 50, q: filters.q }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="درخواست‌ها و پیام‌ها"
        description="درخواست مشاوره سایز، پیام‌های تماس با ما و مشترکان خبرنامه."
      />

      <Card className="mb-4 space-y-3">
        <Suspense fallback={<div className="skeleton h-11 rounded-md" />}>
          <AdminSearch placeholder="نام، شماره موبایل، ایمیل یا موضوع" />
        </Suspense>
        {tab !== "newsletter" && (
          <Suspense fallback={null}>
            <AdminFilterChips
              param="status"
              options={[
                { value: "", label: "همه" },
                { value: "new", label: "جدید" },
                { value: "in_progress", label: "در حال بررسی" },
                { value: "contacted", label: "تماس گرفته شد" },
                { value: "completed", label: "تکمیل شده" },
              ]}
            />
          </Suspense>
        )}
      </Card>

      <Suspense fallback={null}>
        <RequestTabs
          counts={{
            consultations: consultations.total,
            contact: messages.total,
            newsletter: subscribers.total,
          }}
        />
      </Suspense>

      {/* ------------------------------------------------ consultations -- */}
      {tab === "consultations" && (
        consultations.items.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="size-7" aria-hidden />}
            title="درخواست مشاوره‌ای نیست"
            description="درخواست‌های ثبت‌شده از فرم مشاوره سایز اینجا نمایش داده می‌شوند."
          />
        ) : (
          <ul className="space-y-3">
            {consultations.items.map((request) => (
              <li key={request.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-fg">
                        {request.fullName}
                        <span className="tnum text-sm font-normal text-fg-muted" dir="ltr">
                          {request.number}
                        </span>
                      </p>
                      <p className="tnum mt-1 text-xs text-fg-muted" dir="ltr">
                        {formatPhone(request.phone)}
                      </p>
                      <p className="mt-0.5 text-xs text-fg-subtle">
                        {formatDate(request.createdAt)}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[request.status] ?? "neutral"} size="sm">
                      {request.statusLabel}
                    </Badge>
                  </div>

                  {Object.keys(request.answers).length > 0 && (
                    <dl className="mt-4 grid gap-2 border-t border-border pt-3 text-sm sm:grid-cols-2">
                      {Object.entries(request.answers).map(([key, value]) => (
                        <div key={key} className="flex justify-between gap-3">
                          <dt className="text-fg-muted">{key}</dt>
                          <dd className="text-end text-fg">
                            {Array.isArray(value) ? value.join("، ") : String(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  {request.message && (
                    <p className="mt-3 rounded-md bg-surface-2 p-3 text-sm leading-7 text-fg-muted">
                      {request.message}
                    </p>
                  )}

                  {request.adminNote && (
                    <p className="mt-2 text-xs text-fg-subtle">یادداشت: {request.adminNote}</p>
                  )}

                  <div className="mt-4 border-t border-border pt-3">
                    <RequestStatusButton
                      endpoint="consultations"
                      requestId={request.id}
                      status={request.status}
                      adminNote={request.adminNote}
                    />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )
      )}

      {/* ------------------------------------------------------ contact -- */}
      {tab === "contact" && (
        messages.items.length === 0 ? (
          <EmptyState
            icon={<Mail className="size-7" aria-hidden />}
            title="پیامی نیست"
            description="پیام‌های فرم تماس با ما اینجا نمایش داده می‌شوند."
          />
        ) : (
          <ul className="space-y-3">
            {messages.items.map((message) => (
              <li key={message.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-fg">{message.subject}</p>
                      <p className="tnum mt-1 flex flex-wrap gap-x-3 text-xs text-fg-muted">
                        <span>{message.fullName}</span>
                        {message.phone && <span dir="ltr">{formatPhone(message.phone)}</span>}
                        {message.email && <span dir="ltr">{message.email}</span>}
                      </p>
                      <p className="mt-0.5 text-xs text-fg-subtle">
                        <span dir="ltr">{message.number}</span> — {formatDate(message.createdAt)}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[message.status] ?? "neutral"} size="sm">
                      {message.statusLabel}
                    </Badge>
                  </div>

                  <p className="mt-3 rounded-md bg-surface-2 p-3 text-sm leading-7 text-fg-muted">
                    {message.message}
                  </p>

                  {message.adminNote && (
                    <p className="mt-2 text-xs text-fg-subtle">یادداشت: {message.adminNote}</p>
                  )}

                  <div className="mt-4 border-t border-border pt-3">
                    <RequestStatusButton
                      endpoint="contact"
                      requestId={message.id}
                      status={message.status}
                      adminNote={message.adminNote}
                    />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )
      )}

      {/* --------------------------------------------------- newsletter -- */}
      {tab === "newsletter" && (
        subscribers.items.length === 0 ? (
          <EmptyState
            icon={<Users className="size-7" aria-hidden />}
            title="مشترکی ثبت نشده است"
            description="ایمیل‌های ثبت‌شده در خبرنامه اینجا نمایش داده می‌شوند."
          />
        ) : (
          <Card padded={false}>
            <ul className="divide-y divide-border">
              {subscribers.items.map((subscriber) => (
                <li key={subscriber.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-fg" dir="ltr">{subscriber.email}</p>
                    <p className="mt-0.5 text-xs text-fg-subtle">
                      {formatDate(subscriber.createdAt)}
                      {subscriber.source && ` — ${subscriber.source}`}
                    </p>
                  </div>
                  {subscriber.active ? (
                    <Badge tone="success" size="sm">فعال</Badge>
                  ) : (
                    <Badge tone="neutral" size="sm">لغو اشتراک</Badge>
                  )}
                </li>
              ))}
            </ul>
            <p className="border-t border-border p-3 text-xs text-fg-subtle">
              مجموع {toPersianDigits(subscribers.total)} مشترک. لغو اشتراک از طریق لینک اختصاصی هر
              ایمیل انجام می‌شود.
            </p>
          </Card>
        )
      )}
    </>
  );
}
