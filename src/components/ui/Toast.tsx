"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn, uid } from "@/lib/utils";

export type ToastTone = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  /** Optional single action, e.g. "بازگردانی" after a destructive change. */
  action?: { label: string; onClick: () => void };
  duration?: number;
}

interface ToastContextValue {
  toast: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const TONE_STYLES: Record<ToastTone, { icon: React.ReactNode; bar: string }> = {
  success: { icon: <CheckCircle2 className="size-5 text-success" aria-hidden />, bar: "bg-success" },
  error: { icon: <AlertCircle className="size-5 text-danger" aria-hidden />, bar: "bg-danger" },
  warning: { icon: <TriangleAlert className="size-5 text-warning" aria-hidden />, bar: "bg-warning" },
  info: { icon: <Info className="size-5 text-info" aria-hidden />, bar: "bg-info" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dismiss = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((input: Omit<Toast, "id">) => {
    const id = uid("toast");
    // Cap the stack so a burst of actions can't bury the page.
    setToasts((list) => [...list.slice(-2), { ...input, id }]);
    const duration = input.duration ?? 4000;
    if (duration > 0) setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div
            // Polite + non-focusing: a toast never steals focus from the user.
            aria-live="polite"
            aria-atomic="false"
            className="pointer-events-none fixed inset-x-0 bottom-0 flex flex-col items-center gap-2 p-4
                       sm:inset-x-auto sm:bottom-6 sm:start-6 sm:items-start"
            style={{ zIndex: "var(--z-toast)", paddingBottom: "calc(1rem + env(safe-area-inset-bottom,0px))" }}
          >
            {toasts.map((t) => {
              const { icon, bar } = TONE_STYLES[t.tone];
              return (
                <div
                  key={t.id}
                  role={t.tone === "error" ? "alert" : "status"}
                  className="animate-slide-up pointer-events-auto flex w-full max-w-sm gap-3 overflow-hidden rounded-lg
                             border border-border bg-surface p-3 shadow-e3"
                >
                  <span aria-hidden className={cn("w-1 shrink-0 rounded-full", bar)} />
                  <span className="mt-0.5 shrink-0">{icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-fg">{t.title}</p>
                    {t.description && <p className="mt-0.5 text-sm leading-6 text-fg-muted">{t.description}</p>}
                    {t.action && (
                      <button
                        type="button"
                        onClick={() => { t.action!.onClick(); dismiss(t.id); }}
                        className="mt-2 text-sm font-semibold text-primary underline-offset-4 hover:underline dark:text-[color:var(--primary-soft-fg)]"
                      >
                        {t.action.label}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(t.id)}
                    aria-label="بستن پیام"
                    className="grid size-8 shrink-0 place-items-center self-start rounded-md text-fg-subtle hover:bg-surface-2 hover:text-fg"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}
