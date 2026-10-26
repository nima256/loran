"use client";

import { useEffect, useState } from "react";
import { siteConfig } from "@/lib/site-config";

/**
 * Floating Telegram support button (@loranadmin).
 *
 * Bottom-left corner (`end` in this RTL layout), above the mobile bottom
 * navigation. It appears only after the user has scrolled past the hero, so it
 * never competes with the first impression, and collapses to a circle on
 * phones to stay out of the way of content.
 */
export function TelegramButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <a
      href={siteConfig.contact.telegramUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`گفت‌وگو با پشتیبانی لوران در تلگرام (${siteConfig.contact.telegramHandle})`}
      className={[
        "no-print fixed end-4 flex items-center gap-2 rounded-full bg-[#229ED9] text-white shadow-e3",
        "h-12 w-12 justify-center sm:w-auto sm:pe-4 sm:ps-1.5",
        "transition-[opacity,transform] duration-[--dur-slow] ease-[--ease-out] hover:brightness-110",
        visible ? "opacity-100 translate-y-0" : "pointer-events-none translate-y-3 opacity-0",
      ].join(" ")}
      style={{
        zIndex: "var(--z-sticky)",
        bottom: "calc(var(--bottom-nav-h) + 1rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {/* Telegram's official mark: white paper plane on the brand-blue disc. */}
      <svg viewBox="0 0 240 240" className="size-9 shrink-0" aria-hidden>
        <defs>
          <linearGradient id="telegram-disc" x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0" stopColor="#2AABEE" />
            <stop offset="1" stopColor="#229ED9" />
          </linearGradient>
        </defs>
        <circle cx="120" cy="120" r="120" fill="url(#telegram-disc)" />
        <path
          fill="#fff"
          d="M54.3 118.8c35-15.2 58.3-25.3 70-30.2 33.3-13.9 40.3-16.3 44.8-16.4 1 0 3.2.2 4.7 1.4 1.2 1 1.5 2.3 1.7 3.3.2 1 .4 3.1.2 4.7-1.8 19-9.6 65.1-13.6 86.3-1.7 9-5 12-8.2 12.3-7 .6-12.3-4.6-19-9-10.6-6.9-16.5-11.2-26.8-18-11.9-7.8-4.2-12.1 2.6-19.1 1.8-1.8 32.5-29.8 33.1-32.3.1-.3.1-1.5-.6-2.1-.7-.6-1.7-.4-2.5-.2-1.1.2-17.9 11.4-50.6 33.5-4.8 3.3-9.1 4.9-13 4.8-4.3-.1-12.5-2.4-18.7-4.4-7.5-2.4-13.5-3.7-13-7.9.3-2.2 3.3-4.4 9-6.7z"
        />
      </svg>
      <span className="hidden text-sm font-medium sm:inline">پشتیبانی در تلگرام</span>
    </a>
  );
}
