import { Skeleton } from "@/components/ui/Feedback";

/**
 * Route-level loading shell.
 *
 * Mirrors the real page's shape so the content does not jump when it arrives,
 * and gives immediate feedback on a navigation that has to reach the database.
 */
export default function Loading() {
  return (
    <div className="container-page py-8" role="status" aria-label="در حال بارگذاری">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-3 h-4 w-72 max-w-full" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
      <span className="sr-only">در حال بارگذاری…</span>
    </div>
  );
}
