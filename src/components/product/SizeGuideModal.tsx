"use client";

import { Modal } from "@/components/ui/Overlay";
import { Alert } from "@/components/ui/Feedback";
import { toPersianDigits } from "@/lib/format";

/** EU → cm conversion table. Replace with Loran's measured chart before launch. */
const ROWS = [
  { eu: 36, cm: 22.5, us: "5" }, { eu: 37, cm: 23.5, us: "6" }, { eu: 38, cm: 24, us: "6.5" },
  { eu: 39, cm: 25, us: "7" }, { eu: 40, cm: 25.5, us: "7.5" }, { eu: 41, cm: 26.5, us: "8.5" },
  { eu: 42, cm: 27, us: "9" }, { eu: 43, cm: 28, us: "10" }, { eu: 44, cm: 28.5, us: "10.5" },
  { eu: 45, cm: 29.5, us: "11.5" }, { eu: 46, cm: 30, us: "12" },
];

export function SizeGuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="راهنمای سایز" description="اندازه‌ها تقریبی است و بین مدل‌ها کمی تفاوت دارد." size="lg">
      <div className="space-y-5">
        <Alert tone="info" title="چطور پا را اندازه بگیرم؟">
          <ol className="list-decimal space-y-1 ps-5">
            <li>کاغذ A4 را روی زمین و کنار دیوار بگذارید.</li>
            <li>پاشنه را به دیوار بچسبانید و روی کاغذ بایستید.</li>
            <li>نوک بلندترین انگشت را علامت بزنید و فاصله تا لبه کاغذ را اندازه بگیرید.</li>
            <li>عدد به‌دست‌آمده را با ستون «طول پا» در جدول زیر مقایسه کنید.</li>
          </ol>
        </Alert>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">جدول تبدیل سایز اروپایی به طول پا</caption>
            <thead>
              <tr className="border-b border-border bg-surface-2 text-fg-muted">
                <th scope="col" className="px-4 py-3 text-start font-medium">سایز اروپایی (EU)</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">طول پا (سانتی‌متر)</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">معادل US</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ROWS.map((row) => (
                <tr key={row.eu}>
                  <td className="tnum px-4 py-2.5 font-medium text-fg">{toPersianDigits(row.eu)}</td>
                  <td className="tnum px-4 py-2.5 text-fg-muted">{toPersianDigits(row.cm)}</td>
                  <td className="tnum px-4 py-2.5 text-fg-muted">{toPersianDigits(row.us)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-sm leading-7 text-fg-muted">
          اگر بین دو سایز مردد هستید، سایز بزرگ‌تر را انتخاب کنید. برای مدل‌های ورزشی معمولاً نیم
          سایز بزرگ‌تر راحت‌تر است. در صورت نیاز می‌توانید پیش از خرید با پشتیبانی لوران مشورت کنید.
        </p>
      </div>
    </Modal>
  );
}
