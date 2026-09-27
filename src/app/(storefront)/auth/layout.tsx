import Link from "next/link";
import { Logo } from "@/components/layout/Logo";

/** Focused, distraction-free shell for the sign-in flow. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-narrow flex min-h-[70vh] flex-col items-center justify-center py-10">
      <Link href="/" className="mb-8 rounded-md" aria-label="بازگشت به صفحه اصلی لوران">
        <Logo size="lg" href={null} />
      </Link>
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-8 max-w-sm text-center text-xs leading-6 text-fg-subtle">
        با ورود به لوران،{" "}
        <Link href="/terms" className="text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]">قوانین و مقررات</Link>
        {" "}و{" "}
        <Link href="/privacy" className="text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]">حریم خصوصی</Link>
        {" "}را می‌پذیرید.
      </p>
    </div>
  );
}
