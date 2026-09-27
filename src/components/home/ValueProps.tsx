import { BadgeCheck, Headphones, RefreshCw, Truck } from "lucide-react";
import { siteConfig } from "@/lib/site-config";
import { toPersianDigits } from "@/lib/format";

/** Trust strip. Four short promises, no illustrations, no decoration. */
export function ValueProps() {
  const items = [
    { icon: Truck, title: "ارسال به سراسر ایران", body: "با تیپاکس، ۲ تا ۴ روز کاری" },
    {
      icon: RefreshCw,
      title: `${toPersianDigits(siteConfig.commerce.returnWindowDays)} روز مهلت تعویض`,
      body: "اگر سایز مناسب نبود، تعویض کنید",
    },
    { icon: BadgeCheck, title: "ضمانت اصالت کالا", body: "همان کفشی که در ویترین می‌بینید" },
    { icon: Headphones, title: "پشتیبانی و مشاوره سایز", body: siteConfig.contact.workingHours },
  ];

  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(({ icon: Icon, title, body }) => (
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
