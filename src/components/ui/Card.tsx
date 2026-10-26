import { cn } from "@/lib/utils";

/** Neutral surface container — the default block used across the whole app. */
export function Card({
  as: Tag = "div", padded = true, className, children, ...props
}: { as?: React.ElementType; padded?: boolean; className?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cn("min-w-0 rounded-lg border border-border bg-surface", padded && "p-4 sm:p-5", className)} {...props}>
      {children}
    </Tag>
  );
}

/** Section heading with an optional "see all" link, used on the homepage. */
export function SectionHeader({
  title, description, action, className, id,
}: { title: string; description?: string; action?: React.ReactNode; className?: string; id?: string }) {
  return (
    <div className={cn("mb-5 flex items-end justify-between gap-4 sm:mb-6", className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-xl font-bold text-fg sm:text-2xl">{title}</h2>
        {description && <p className="mt-1.5 text-sm leading-7 text-fg-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/**
 * Responsive data table: a real <table> on desktop, stacked cards on mobile.
 * The mobile view is rendered by the caller via `renderCard` so each table can
 * choose what matters on a small screen instead of squeezing every column in.
 */
export function DataTable<T>({
  columns, rows, renderCard, getKey, empty, className,
}: {
  columns: { key: string; header: string; align?: "start" | "end" | "center"; cell: (row: T) => React.ReactNode; hideOn?: "md" }[];
  rows: T[];
  renderCard?: (row: T) => React.ReactNode;
  getKey: (row: T) => string;
  empty?: React.ReactNode;
  className?: string;
}) {
  if (!rows.length && empty) return <>{empty}</>;

  return (
    <div className={className}>
      {renderCard && (
        <div className="space-y-3 lg:hidden">
          {rows.map((row) => <div key={getKey(row)}>{renderCard(row)}</div>)}
        </div>
      )}
      <div className={cn("overflow-x-auto rounded-lg border border-border bg-surface", renderCard && "hidden lg:block")}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-fg-muted">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "whitespace-nowrap px-4 py-3 font-medium",
                    col.align === "end" ? "text-end" : col.align === "center" ? "text-center" : "text-start",
                    col.hideOn === "md" && "hidden xl:table-cell"
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={getKey(row)} className="transition-colors hover:bg-surface-2/60">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-4 py-3 align-middle",
                      col.align === "end" ? "text-end" : col.align === "center" ? "text-center" : "text-start",
                      col.hideOn === "md" && "hidden xl:table-cell"
                    )}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
