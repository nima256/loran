import type { Metadata, Viewport } from "next";
import { Providers } from "@/store/Providers";
import { themeInitScript } from "@/store/ThemeProvider";
import { siteConfig } from "@/lib/site-config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} | فروشگاه اینترنتی کفش`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  openGraph: {
    type: "website",
    locale: "fa_IR",
    siteName: siteConfig.name,
    title: `${siteConfig.name} | فروشگاه اینترنتی کفش`,
    description: siteConfig.description,
  },
  icons: { icon: "/brand/loran-icon-96.png", apple: "/brand/loran-apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Zoom is never disabled — users must be able to scale the page.
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBF9F6" },
    { media: "(prefers-color-scheme: dark)", color: "#17120F" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        {/* Applies the stored theme before first paint to avoid a flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
