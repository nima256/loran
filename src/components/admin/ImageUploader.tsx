"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { isLocalUpload } from "@/lib/media";
import { Check, GripVertical, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/Feedback";
import { api, errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/utils";

/**
 * Product image uploader.
 *
 * Uploads go to `/api/v1/admin/media`, which validates by *decoding* the image
 * rather than trusting its name or declared type, re-encodes to WebP, strips
 * EXIF and gives it a server-generated filename. This component therefore does
 * no validation of its own beyond a friendly pre-check — the server is the
 * gate, and it is the one that answers.
 *
 * The first image is the one the storefront uses as the card thumbnail, so the
 * order is meaningful and adjustable.
 *
 * Two optional modes:
 *  - `selectable`: each thumbnail gets a checkbox, so the editor can move a
 *    chosen set of images to another colour without re-uploading them;
 *  - `max={1}`: a single-image field (category / collection cover). A new
 *    upload replaces the current image, and the preview shows before saving.
 */
export function ImageUploader({
  images,
  onChange,
  disabled,
  onUploadingChange,
  folder = "products",
  max,
  selectable,
  selected = [],
  onSelectedChange,
  hint,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  disabled?: boolean;
  onUploadingChange?: (uploading: boolean) => void;
  /** Storage folder on the server. */
  folder?: string;
  /** Maximum number of images. `1` makes a replace-on-upload single field. */
  max?: number;
  selectable?: boolean;
  selected?: string[];
  onSelectedChange?: (selected: string[]) => void;
  hint?: string;
}) {
  const single = max === 1;
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadInProgress = useRef(false);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length || uploadInProgress.current || disabled) return;
    uploadInProgress.current = true;
    onUploadingChange?.(true);
    setError(null);
    setUploading(files.length);

    const uploaded: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        form.append("folder", folder);
        try {
          const result = await api.upload<{ url: string }>("/api/v1/admin/media", form);
          // The upload response alone is not proof the new URL is actually
          // served by this server. Prevent saving a broken product gallery.
          const check = await fetch(result.url, { method: "HEAD", cache: "no-store" });
          if (!check.ok || !check.headers.get("content-type")?.startsWith("image/")) {
            throw new Error("فایل روی دیسک ثبت شد اما آدرس نمایش تصویر قابل دسترسی نیست. تنظیمات مسیر uploads را بررسی کنید.");
          }
          uploaded.push(result.url);
        } catch (caught) {
          setError(errorMessage(caught));
        } finally {
          setUploading((n) => n - 1);
        }
      }
      if (uploaded.length) {
        const next = single ? uploaded.slice(-1) : [...images, ...uploaded];
        onChange(max ? next.slice(-max) : next);
      }
    } finally {
      if (inputRef.current) inputRef.current.value = "";
      uploadInProgress.current = false;
      onUploadingChange?.(false);
      setUploading(0);
    }
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const toggleSelected = (url: string) =>
    onSelectedChange?.(selected.includes(url) ? selected.filter((u) => u !== url) : [...selected, url]);

  const full = max != null && images.length >= max && !single;

  return (
    <div>
      <ul className={cn("grid gap-3", single ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4")}>
        {images.map((url, index) => {
          const isSelected = selectable && selected.includes(url);
          return (
          <li
            key={url}
            className={cn(
              "group relative overflow-hidden rounded-md border bg-surface-inset",
              isSelected ? "border-primary ring-2 ring-primary/40" : "border-border"
            )}
          >
            <div className="relative aspect-square">
              <Image src={url} unoptimized={isLocalUpload(url)} alt="" fill sizes="200px" className="object-cover" />
            </div>

            {selectable && (
              <button
                type="button"
                onClick={() => toggleSelected(url)}
                disabled={disabled || uploading > 0}
                aria-pressed={isSelected}
                aria-label={isSelected ? `لغو انتخاب تصویر ${index + 1}` : `انتخاب تصویر ${index + 1}`}
                // Covers the image: on a phone the whole thumbnail is the target.
                className="absolute inset-0 z-[1] flex items-start justify-end p-1.5"
              >
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-md border-2 shadow-e1",
                    isSelected ? "border-primary bg-primary text-primary-fg" : "border-white bg-black/30 text-transparent"
                  )}
                >
                  <Check className="size-4" aria-hidden />
                </span>
              </button>
            )}

            {index === 0 && !single && (
              <span className="absolute top-1.5 start-1.5 rounded bg-primary px-1.5 py-0.5 text-[0.625rem] font-medium text-primary-fg">
                تصویر اصلی
              </span>
            )}

            {!selectable && (
            // Hover-revealed on pointer devices; always visible on touch,
            // where there is no hover to reveal it.
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-[#1b1310]/70 p-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
              <span className={cn("flex gap-0.5", single && "invisible")}>
                <button
                  type="button"
                  onClick={() => move(index, index - 1)}
                  disabled={disabled || uploading > 0 || index === 0}
                  aria-label="انتقال به عقب"
                  className="grid size-7 place-items-center rounded text-white/80 hover:bg-white/15 disabled:opacity-40"
                >
                  <GripVertical className="size-3.5 rotate-90" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, index + 1)}
                  disabled={disabled || uploading > 0 || index === images.length - 1}
                  aria-label="انتقال به جلو"
                  className="grid size-7 place-items-center rounded text-white/80 hover:bg-white/15 disabled:opacity-40"
                >
                  <GripVertical className="size-3.5 -rotate-90" aria-hidden />
                </button>
              </span>
              <button
                type="button"
                onClick={() => onChange(images.filter((_, i) => i !== index))}
                disabled={disabled || uploading > 0}
                aria-label="حذف تصویر"
                className="grid size-7 place-items-center rounded text-white/80 hover:bg-danger/80"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </div>
            )}
          </li>
          );
        })}

        {uploading > 0 && (
          <li className="grid aspect-square place-items-center rounded-md border border-dashed border-border bg-surface-2">
            <span className="flex flex-col items-center gap-2 text-xs text-fg-muted">
              <Loader2 className="size-5 animate-spin" aria-hidden />
              در حال آپلود…
            </span>
          </li>
        )}

        {!full && (
        <li>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || uploading > 0}
            className={cn(
              "grid aspect-square w-full place-items-center rounded-md border border-dashed border-border",
              "text-fg-subtle transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
            )}
          >
            <span className="flex flex-col items-center gap-2 text-xs">
              <ImagePlus className="size-6" aria-hidden />
              {single && images.length ? "جایگزینی تصویر" : "افزودن تصویر"}
            </span>
          </button>
        </li>
        )}
      </ul>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple={!single}
        hidden
        onChange={(e) => void upload(e.target.files)}
      />

      {error && <Alert tone="danger" role="alert" className="mt-3">{error}</Alert>}

      <p className="mt-2 text-xs text-fg-subtle">
        {hint ??
          "فرمت‌های JPEG، PNG، WebP و AVIF تا ۵ مگابایت. تصاویر روی سرور بهینه و به WebP تبدیل می‌شوند. اولین تصویر، تصویر اصلی کارت محصول است."}
      </p>
    </div>
  );
}
