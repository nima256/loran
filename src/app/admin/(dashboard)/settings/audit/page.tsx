import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminPagination, AdminResultCount } from "@/components/admin/AdminTableControls";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Feedback";
import { listAuditLog } from "@/server/services/settings";
import { formatDateTime } from "@/lib/format";

/** The full administrative audit trail. */

export const dynamic = "force-dynamic";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const result = await listAuditLog({ page, pageSize: 50, action: params.action });

  return (
    <>
      <Link href="/admin/settings" className="mb-4 inline-flex min-h-9 items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowRight className="size-4" aria-hidden />
        بازگشت به تنظیمات
      </Link>

      <AdminPageHeader
        title="سابقه عملیات مدیریتی"
        description="هر تغییر مهم در پنل، با زمان و شناسه مدیر."
      />

      <div className="mb-3">
        <AdminResultCount
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          noun="رکورد"
        />
      </div>

      <Card padded={false}>
        {result.items.length === 0 ? (
          <EmptyState className="border-0" title="رکوردی ثبت نشده است" />
        ) : (
          <ul className="divide-y divide-border">
            {result.items.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm text-fg">{entry.summary}</p>
                  <p className="tnum mt-1 flex flex-wrap gap-x-3 text-xs text-fg-subtle">
                    <span dir="ltr">{entry.action}</span>
                    <span dir="ltr">{entry.entityType}</span>
                    {entry.adminEmail && <span dir="ltr">{entry.adminEmail}</span>}
                  </p>
                </div>
                <span className="tnum whitespace-nowrap text-xs text-fg-muted">
                  {formatDateTime(entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Suspense fallback={null}>
        <AdminPagination page={result.page} totalPages={result.totalPages} className="mt-6" />
      </Suspense>
    </>
  );
}
