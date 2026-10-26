"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Opens the browser's print dialog.
 *
 * `window.print()` blocks the main thread synchronously, so the pending label
 * is painted on the next frame first — otherwise the button appears to do
 * nothing for as long as the dialog takes to appear.
 */
export function PrintButton({ label = "چاپ" }: { label?: string }) {
  const [printing, setPrinting] = useState(false);

  const print = () => {
    setPrinting(true);
    requestAnimationFrame(() => {
      window.print();
      setPrinting(false);
    });
  };

  return (
    <Button
      onClick={print}
      loading={printing}
      disabled={printing}
      icon={<Printer className="size-4" aria-hidden />}
    >
      {printing ? "در حال آماده‌سازی…" : label}
    </Button>
  );
}
