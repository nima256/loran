"use client";

import { useEffect, useState } from "react";
import { siteConfig } from "@/lib/site-config";

/**
 * Floating WhatsApp contact.
 *
 * Sits above the mobile bottom navigation, appears only after the user has
 * scrolled past the hero (so it never competes with the first impression), and
 * collapses to a circle on phones to stay out of the way.
 */
export function WhatsAppButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const number = siteConfig.contact.whatsapp.replace(/[^\d]/g, "");

  return (
    <a
      href={`https://wa.me/${number}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="گفت‌وگو در واتس‌اپ با پشتیبانی لوران"
      className={[
        "no-print fixed end-4 flex items-center gap-2 rounded-full bg-[#1F7A4D] text-white shadow-e3",
        "h-12 w-12 justify-center sm:w-auto sm:px-4",
        "transition-[opacity,transform] duration-[--dur-slow] ease-[--ease-out] hover:brightness-110",
        visible ? "opacity-100 translate-y-0" : "pointer-events-none translate-y-3 opacity-0",
      ].join(" ")}
      style={{
        zIndex: "var(--z-sticky)",
        bottom: "calc(var(--bottom-nav-h) + 1rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <svg viewBox="0 0 24 24" className="size-6 shrink-0 fill-current" aria-hidden>
        <path d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.48 1.34 5L2 22l5.2-1.36a9.9 9.9 0 0 0 4.84 1.24h.01c5.5 0 9.96-4.46 9.96-9.96 0-2.66-1.04-5.16-2.92-7.04A9.88 9.88 0 0 0 12.04 2Zm0 18.16h-.01a8.27 8.27 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.24 8.24 0 0 1-1.26-4.38c0-4.56 3.71-8.27 8.27-8.27 2.21 0 4.28.86 5.84 2.42a8.2 8.2 0 0 1 2.42 5.85c0 4.56-3.71 8.24-8.27 8.24Zm4.53-6.17c-.25-.13-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.13-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.84-.86 2.05s.89 2.38 1.01 2.54c.12.17 1.74 2.66 4.22 3.73.59.25 1.05.4 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.29Z" />
      </svg>
      <span className="hidden text-sm font-medium sm:inline">مشاوره در واتس‌اپ</span>
    </a>
  );
}
