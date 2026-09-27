"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Global navigation progress.
 *
 * App Router navigations to a server-rendered page can take a moment before
 * anything on screen changes, which makes a link feel broken. This draws a thin
 * brand-coloured bar at the top of the viewport the instant a navigation starts
 * and retires it when the new route commits.
 *
 * Deliberately *not* a full-page loading screen: the current page stays
 * readable and interactive underneath, which is the better experience when the
 * destination is a fraction of a second away.
 *
 * Two details that matter:
 *  - The bar only appears after a short delay, so a fast navigation doesn't
 *    produce a distracting flash.
 *  - Progress eases towards 90% and never reaches it on its own; only the
 *    actual route change completes it. A bar that fills and then sits there is
 *    worse than no bar.
 */

/** Below this, a navigation is perceived as instant and needs no indicator. */
const SHOW_AFTER_MS = 120;
const DONE_HOLD_MS = 220;

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  // The route that is currently on screen. A click that would land on the same
  // route is not a navigation and must not start the bar.
  const currentRoute = `${pathname}?${searchParams}`;
  const activeRoute = useRef(currentRoute);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (ticker.current) {
      clearInterval(ticker.current);
      ticker.current = null;
    }
  };

  /* --- The route committed: finish the bar. --------------------------- */
  useEffect(() => {
    if (activeRoute.current === currentRoute) return;
    activeRoute.current = currentRoute;

    clearTimers();
    setProgress(100);
    timers.current.push(
      setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, DONE_HOLD_MS)
    );
  }, [currentRoute]);

  /* --- A navigation started: begin the bar. ---------------------------- */
  useEffect(() => {
    const start = () => {
      clearTimers();
      timers.current.push(
        setTimeout(() => {
          setVisible(true);
          setProgress(12);
          // Ease towards 90% — the remaining 10% belongs to the real commit.
          ticker.current = setInterval(() => {
            setProgress((value) => (value >= 90 ? value : value + (90 - value) * 0.12));
          }, 180);
        }, SHOW_AFTER_MS)
      );
    };

    /** A left-click on an in-app link that actually changes the route. */
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.target === "_blank") return;
      if (anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      // External links hand off to the browser, which draws its own indicator.
      if (url.origin !== window.location.origin) return;
      // Same URL: React will not navigate, so the bar would never be retired.
      if (url.pathname + url.search === window.location.pathname + window.location.search) return;

      start();
    };

    // Back/forward also change the route and deserve the same feedback.
    const onPopState = () => start();

    document.addEventListener("click", onClick, { capture: true });
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("popstate", onPopState);
      clearTimers();
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      // Decorative: the pending state is also announced by the pages
      // themselves, so this must not add noise for screen-reader users.
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 h-0.5"
      style={{ zIndex: 200 }}
    >
      <div
        className="h-full bg-primary shadow-[0_0_8px_var(--primary)] transition-[width,opacity] duration-200 ease-out"
        style={{ width: `${progress}%`, opacity: progress >= 100 ? 0 : 1 }}
      />
    </div>
  );
}
