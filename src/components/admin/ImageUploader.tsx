"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { GripVertical, ImagePlus, Loader2, Trash2 } from "lucide-react";
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
 */
export function ImageUploader({
  images,
  onChange,
  disabled,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    setUploading(files.length);

    const uploaded: string[] = [];
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", "products");
      try {
        const result = await api.upload<{ url: string }>("/api/v1/admin/media", form);
        uploaded.push(result.url);
      } catch (caught) {
        setError(errorMessage(caught));
      } finally {
        setUploading((n) => n - 1);
      }
    }

    if (uploaded.length) onChange([...images, ...uploaded]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {images.map((url, index) => (
          <li key={url} className="group relative overflow-hidden rounded-md border border-border bg-surface-inset">
            <div className="relative aspect-square">
              <Image src={url} alt="" fill sizes="200px" className="object-cover" />
            </div>

            {index === 0 && (
              <span className="absolute top-1.5 start-1.5 rounded bg-primary px-1.5 py-0.5 text-[0.625rem] font-medium text-primary-fg">
                تصویر اصلی
              </span>
            )}

            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-[#1b1310]/70 p-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
              <span className="flex gap-0.5">
                <button
                  type="button"
                  onClick={() => move(index, index - 1)}
                  disabled={disabled || index === 0}
                  aria-label="انتقال به عقب"
                  className="grid size-7 place-items-center rounded text-white/80 hover:bg-white/15 disabled:opacity-40"
                >
                  <GripVertical className="size-3.5 rotate-90" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, index + 1)}
                  disabled={disabled || index === images.length - 1}
                  aria-label="انتقال به جلو"
                  className="grid size-7 place-items-center rounded text-white/80 hover:bg-white/15 disabled:opacity-40"
                >
                  <GripVertical className="size-3.5 -rotate-90" aria-hidden />
                </button>
              </span>
              <button
                type="button"
                onClick={() => onChange(images.filter((_, i) => i !== index))}
                disabled={disabled}
                aria-label="حذف تصویر"
                className="grid size-7 place-items-center rounded text-white/80 hover:bg-danger/80"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </div>
          </li>
        ))}

        {uploading > 0 && (
          <li className="grid aspect-square place-items-center rounded-md border border-dashed border-border bg-surface-2">
            <span className="flex flex-col items-center gap-2 text-xs text-fg-muted">
              <Loader2 className="size-5 animate-spin" aria-hidden />
              در حال آپلود…
            </span>
          </li>
        )}

        <li>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className={cn(
              "grid aspect-square w-full place-items-center rounded-md border border-dashed border-border",
              "text-fg-subtle transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
            )}
          >
            <span className="flex flex-col items-center gap-2 text-xs">
              <ImagePlus className="size-6" aria-hidden />
              افزودن تصویر
            </span>
          </button>
        </li>
      </ul>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        hidden
        onChange={(e) => void upload(e.target.files)}
      />

      {error && <Alert tone="danger" role="alert" className="mt-3">{error}</Alert>}

      <p className="mt-2 text-xs text-fg-subtle">
        فرمت‌های JPEG، PNG، WebP و AVIF تا ۵ مگابایت. تصاویر روی سرور بهینه و به WebP تبدیل
        می‌شوند. اولین تصویر، تصویر اصلی کارت محصول است.
      </p>
    </div>
  );
}
