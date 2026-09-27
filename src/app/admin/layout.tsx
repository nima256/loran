import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "پنل مدیریت", template: "%s | پنل مدیریت لوران" },
  robots: { index: false, follow: false },
};

/**
 * Bare admin layout.
 *
 * Only metadata lives here, because the sign-in screen sits under `/admin` too
 * and must render without the shell. The authenticated pages are in the
 * `(dashboard)` group, whose layout performs the server-side check.
 */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
