import type { Metadata } from "next";
import { ContentList, ContentPage, ContentSection } from "@/components/ui/Prose";
import { Alert } from "@/components/ui/Feedback";
import { toPersianDigits } from "@/lib/format";

export const metadata: Metadata = {
  title: "راهنمای سایز",
  description: "جدول تبدیل سایز اروپایی به طول پا و روش اندازه‌گیری درست پا.",
};

/** Replace with Loran's own measured chart once available. */
const ROWS = [
  { eu: 36, cm: 22.5, us: "5", uk: "3.5" }, { eu: 37, cm: 23.5, us: "6", uk: "4" },
  { eu: 38, cm: 24, us: "6.5", uk: "5" }, { eu: 39, cm: 25, us: "7", uk: "6" },
  { eu: 40, cm: 25.5, us: "7.5", uk: "6.5" }, { eu: 41, cm: 26.5, us: "8.5", uk: "7.5" },
  { eu: 42, cm: 27, us: "9", uk: "8" }, { eu: 43, cm: 28, us: "10", uk: "9" },
  { eu: 44, cm: 28.5, us: "10.5", uk: "9.5" }, { eu: 45, cm: 29.5, us: "11.5", uk: "10.5" },
  { eu: 46, cm: 30, us: "12", uk: "11" },
];

const KIDS = [
  { eu: 28, cm: 17.5 }, { eu: 29, cm: 18 }, { eu: 30, cm: 18.5 }, { eu: 31, cm: 19.5 },
  { eu: 32, cm: 20 }, { eu: 33, cm: 20.5 }, { eu: 34, cm: 21.5 }, { eu: 35, cm: 22 },
];

export default function SizeGuidePage() {
  return (
    <ContentPage
      title="راهنمای سایز"
      breadcrumb="راهنمای سایز"
      draft
      lead="با اندازه‌گیری ساده طول پا، سایز درست را انتخاب کنید و احتمال تعویض را کم کنید."
    >
      <ContentSection title="چطور پا را اندازه بگیریم؟">
        <ol className="not-prose space-y-2">
          {[
            "عصر روز اندازه بگیرید؛ پا در پایان روز کمی بزرگ‌تر است.",
            "کاغذ A4 را روی زمین صاف و چسبیده به دیوار بگذارید.",
            "با جوراب معمولی، پاشنه را به دیوار بچسبانید و روی کاغذ بایستید.",
            "نوک بلندترین انگشت را روی کاغذ علامت بزنید.",
            "فاصله لبه کاغذ تا علامت را با خط‌کش بر حسب سانتی‌متر اندازه بگیرید.",
            "هر دو پا را اندازه بگیرید و عدد بزرگ‌تر را ملاک قرار دهید.",
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="tnum grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary-soft-fg">
                {toPersianDigits(i + 1)}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </ContentSection>

      <ContentSection title="جدول سایز بزرگسال">
        <div className="not-prose overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">جدول تبدیل سایز بزرگسال</caption>
            <thead>
              <tr className="border-b border-border bg-surface-2 text-fg-muted">
                <th scope="col" className="px-4 py-3 text-start font-medium">سایز اروپایی (EU)</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">طول پا (cm)</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">US</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">UK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {ROWS.map((row) => (
                <tr key={row.eu}>
                  <td className="tnum px-4 py-2.5 font-medium text-fg">{toPersianDigits(row.eu)}</td>
                  <td className="tnum px-4 py-2.5 text-fg-muted">{toPersianDigits(row.cm)}</td>
                  <td className="tnum px-4 py-2.5 text-fg-muted">{toPersianDigits(row.us)}</td>
                  <td className="tnum px-4 py-2.5 text-fg-muted">{toPersianDigits(row.uk)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ContentSection>

      <ContentSection title="جدول سایز بچگانه">
        <div className="not-prose overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">جدول تبدیل سایز بچگانه</caption>
            <thead>
              <tr className="border-b border-border bg-surface-2 text-fg-muted">
                <th scope="col" className="px-4 py-3 text-start font-medium">سایز اروپایی (EU)</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">طول پا (cm)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {KIDS.map((row) => (
                <tr key={row.eu}>
                  <td className="tnum px-4 py-2.5 font-medium text-fg">{toPersianDigits(row.eu)}</td>
                  <td className="tnum px-4 py-2.5 text-fg-muted">{toPersianDigits(row.cm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Alert tone="info" className="mt-4">
          برای بچه‌ها معمولاً نیم تا یک سانتی‌متر فضای اضافه در نظر بگیرید تا کفش زودتر کوچک نشود.
        </Alert>
      </ContentSection>

      <ContentSection title="نکته‌های انتخاب سایز">
        <ContentList
          items={[
            "اگر بین دو سایز مردد هستید، سایز بزرگ‌تر را انتخاب کنید.",
            "برای کفش‌های ورزشی و رانینگ، معمولاً نیم سایز بزرگ‌تر راحت‌تر است.",
            "کفش‌های کلاسیک چرمی پس از چند بار پوشیدن کمی جا باز می‌کنند.",
            "اگر پای پهنی دارید، مدل‌هایی با فرم پنجه «پهن» را انتخاب کنید (در مشخصات هر محصول آمده است).",
          ]}
        />
      </ContentSection>
    </ContentPage>
  );
}
