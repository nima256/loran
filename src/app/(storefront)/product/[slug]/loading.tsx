import { Skeleton } from "@/components/ui/Feedback";

export default function ProductLoading() {
  return (
    <div className="container-page py-8" role="status" aria-label="در حال بارگذاری محصول">
      <Skeleton className="h-4 w-64" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-10">
        <div className="flex flex-col-reverse gap-3 md:flex-row">
          <div className="flex gap-2 md:w-20 md:flex-col">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="aspect-square w-16 md:w-full" />)}
          </div>
          <Skeleton className="aspect-square flex-1 rounded-lg" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-36 w-full rounded-lg" />
        </div>
      </div>
      <span className="sr-only">در حال بارگذاری…</span>
    </div>
  );
}
