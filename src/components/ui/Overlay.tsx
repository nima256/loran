"use client";

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./Button";

/** Locks page scroll while an overlay is open, compensating for the scrollbar. */
function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingInlineEnd;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingInlineEnd = `${gap}px`;
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingInlineEnd = previousPadding;
    };
  }, [active]);
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Traps Tab inside the overlay, moves focus in on open and restores it on close.
 * Escape always closes — every overlay in the app has a keyboard escape route.
 */
function useFocusTrap(active: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    restoreTo.current = document.activeElement as HTMLElement;

    const node = ref.current;
    const first = node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null
      );
      if (!items.length) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      restoreTo.current?.focus?.();
    };
  }, [active, onClose]);

  return ref;
}

function Scrim({ onClick }: { onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      aria-hidden
      className="fixed inset-0 bg-[#1b1310]/55 backdrop-blur-[2px] animate-fade-in"
      style={{ zIndex: "var(--z-overlay)" }}
    />
  );
}

interface OverlayBase {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/** Centred dialog. Use for confirmations and short forms, never for navigation. */
export function Modal({ open, onClose, title, description, children, footer, className, size = "md" }: OverlayBase & { size?: "sm" | "md" | "lg" }) {
  useScrollLock(open);
  const ref = useFocusTrap(open, onClose);
  const close = useCallback(() => onClose(), [onClose]);
  if (!open || typeof document === "undefined") return null;

  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

  return createPortal(
    <>
      <Scrim onClick={close} />
      <div className="fixed inset-0 grid place-items-center p-4" style={{ zIndex: "var(--z-modal)" }}>
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          aria-describedby={description ? "modal-desc" : undefined}
          tabIndex={-1}
          className={cn(
            "animate-pop w-full rounded-xl border border-border bg-surface shadow-e3 outline-none",
            "max-h-[calc(100dvh-2rem)] flex flex-col",
            widths[size], className
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border p-5">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-fg">{title}</h2>
              {description && <p id="modal-desc" className="mt-1 text-sm text-fg-muted">{description}</p>}
            </div>
            <IconButton label="بستن" size="sm" onClick={close}><X className="size-5" /></IconButton>
          </div>
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
          {footer && <div className="border-t border-border p-4">{footer}</div>}
        </div>
      </div>
    </>,
    document.body
  );
}

/**
 * Edge drawer. `side="start"` is the inline-start edge, which is the *right*
 * side in this RTL app — used for the mobile menu; `end` is used for the cart.
 */
export function Drawer({ open, onClose, title, children, footer, side = "start", className }: OverlayBase & { side?: "start" | "end" }) {
  useScrollLock(open);
  const ref = useFocusTrap(open, onClose);
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <Scrim onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{ zIndex: "var(--z-drawer)" }}
        className={cn(
          "fixed inset-y-0 flex w-[min(24rem,88vw)] flex-col bg-surface shadow-e3 outline-none",
          side === "start"
            ? "start-0 rounded-s-none rounded-e-2xl animate-drawer-start"
            : "end-0 rounded-e-none rounded-s-2xl animate-drawer-end",
          className
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <h2 className="text-base font-bold text-fg">{title}</h2>
          <IconButton label="بستن" size="sm" onClick={onClose}><X className="size-5" /></IconButton>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <div className="border-t border-border p-4 pb-safe">{footer}</div>}
      </div>
    </>,
    document.body
  );
}

/**
 * Bottom sheet — the mobile pattern for filters and pickers. Capped at 92dvh so
 * the scrim stays visible and the sheet reads as dismissible.
 */
export function BottomSheet({ open, onClose, title, description, children, footer, className }: OverlayBase) {
  useScrollLock(open);
  const ref = useFocusTrap(open, onClose);
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <Scrim onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{ zIndex: "var(--z-drawer)" }}
        className={cn(
          "animate-sheet fixed inset-x-0 bottom-0 flex max-h-[92dvh] flex-col",
          "rounded-t-2xl border-t border-border bg-surface shadow-e3 outline-none",
          className
        )}
      >
        <div className="grid place-items-center pt-3 pb-1">
          <span aria-hidden className="h-1 w-10 rounded-full bg-border-strong" />
        </div>
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 pb-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-fg">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
          </div>
          <IconButton label="بستن" size="sm" onClick={onClose}><X className="size-5" /></IconButton>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
        {footer && <div className="border-t border-border p-4 pb-safe">{footer}</div>}
      </div>
    </>,
    document.body
  );
}
