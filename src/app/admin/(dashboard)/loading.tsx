import { Skeleton } from "@/components/ui/Feedback";

/**
 * Admin route-level loading shell.
 *
 * Switching between Products and Orders reaches the database, so the panel
 * shows the shape of the table it is about to render rather than going blank.
 */
export default function AdminLoading() {
  return (
    <div role="status" aria-label="در حال بارگذاری">
      <Skeleton className="h-7 w-44" />
      <Skeleton className="mt-2 h-4 w-64 max-w-full" />
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
      <div className="mt-5 space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
      <span className="sr-only">در حال بارگذاری…</span>
    </div>
  );
}
