import { BadgeCheck, Headphones, RefreshCw, Truck } from "lucide-react";

/**
 * Trust strip. Four short promises, no illustrations, no decoration.
 * Rendered once, directly above the footer (see the storefront layout).
 */
const ITEMS = [
  { icon: Truck, title: "ارسال به سراسر ایران", body: "با تیپاکس، ۲ تا ۴ روز کاری" },
  { icon: RefreshCw, title: "۲ روز کاری مهلت تعویض", body: "اگر سایز مناسب نبود، تعویض کنید" },
  { icon: BadgeCheck, title: "ضمانت اصالت کالا", body: "همان کفشی که در ویترین می‌بینید" },
  { icon: Headphones, title: "پشتیبانی و مشاوره سایز", body: "شنبه تا پنجشنبه، ۱۰:۰۰ تا ۲۲:۰۰" },
];

export function ValueProps() {
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {ITEMS.map(({ icon: Icon, title, body }) => (
        <li key={title} className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3 sm:p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary-soft text-primary-soft-fg">
            <Icon className="size-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-fg">{title}</span>
            <span className="mt-0.5 block text-xs leading-6 text-fg-muted">{body}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
