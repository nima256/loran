"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Overlay";
import { Input, Textarea } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Alert } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { useAction } from "@/lib/use-action";
import { toPersianDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Categories, colours and sizes.
 *
 * All three share one deletion policy, and the UI says which outcome happened
 * rather than pretending everything was deleted:
 *
 *   in use by a product → deactivated (still referenced, off the storefront)
 *   in use by an order  → refused (history must stay readable)
 *   unused              → deleted
 */

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  description?: string;
  featured?: boolean;
  active?: boolean;
  productCount: number;
}

export interface ColorRow {
  id: string;
  slug: string;
  name: string;
  hex: string;
  active: boolean;
  productCount: number;
  variantCount: number;
}

export interface SizeRow {
  id: string;
  value: number;
  label: string;
  active: boolean;
  variantCount: number;
}

/* -------------------------------------------------------------------------- */
/* Categories                                                                  */
/* -------------------------------------------------------------------------- */

export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [creating, setCreating] = useState(false);

  const remove = useAction(
    async (id: string) =>
      api.delete<{ action: string; message: string }>(`/api/v1/admin/categories/${id}`),
    {
      onSuccess: (result) => {
        toast({
          // A deactivation is not the same as a delete, and saying so avoids
          // the operator wondering why the row is still there.
          tone: result.action === "deleted" ? "success" : "info",
          title: result.action === "deleted" ? "دسته‌بندی حذف شد" : "دسته‌بندی غیرفعال شد",
          description: result.message,
        });
        router.refresh();
      },
      onError: (message) =>
        toast({ tone: "error", title: "حذف انجام نشد", description: message }),
    }
  );

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <h2 className="font-bold text-fg">دسته‌بندی‌ها</h2>
        <Button size="sm" onClick={() => setCreating(true)} icon={<Plus className="size-4" aria-hidden />}>
          افزودن دسته‌بندی
        </Button>
      </div>

      <ul className="divide-y divide-border">
        {categories.map((category) => (
          <li key={category.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium text-fg">
                {category.name}
                {category.featured && <Badge tone="info" size="sm">منتخب</Badge>}
                {category.active === false && <Badge tone="neutral" size="sm">غیرفعال</Badge>}
              </p>
              <p className="mt-0.5 text-xs text-fg-subtle" dir="ltr">/category/{category.slug}</p>
              {category.description && (
                <p className="mt-1 line-clamp-1 text-xs text-fg-muted">{category.description}</p>
              )}
            </div>

            <span className="tnum whitespace-nowrap text-xs text-fg-muted">
              {toPersianDigits(category.productCount)} محصول
            </span>

            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setEditing(category)}
                aria-label={`ویرایش ${category.name}`}
                className="grid size-9 place-items-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-fg"
              >
                <Pencil className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => {
                  const message =
                    category.productCount > 0
                      ? `«${category.name}» ${toPersianDigits(category.productCount)} محصول دارد. به‌جای حذف، غیرفعال می‌شود و از فروشگاه برداشته می‌شود. ادامه می‌دهید؟`
                      : `دسته‌بندی «${category.name}» حذف شود؟`;
                  if (confirm(message)) void remove.run(category.id);
                }}
                disabled={remove.pending}
                aria-label={`حذف ${category.name}`}
                className="grid size-9 place-items-center rounded-md text-fg-subtle hover:bg-danger-soft hover:text-danger disabled:opacity-50"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {categories.length === 0 && (
        <p className="p-6 text-center text-sm text-fg-muted">هنوز دسته‌بندی‌ای تعریف نشده است.</p>
      )}

      <CategoryModal
        open={creating || editing !== null}
        category={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onDone={() => { setCreating(false); setEditing(null); router.refresh(); }}
      />
    </Card>
  );
}

function CategoryModal({
  open, category, onClose, onDone,
}: {
  open: boolean;
  category: CategoryRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [featured, setFeatured] = useState(category?.featured ?? false);
  const [active, setActive] = useState(category?.active ?? true);
  const [error, setError] = useState<string | null>(null);

  // Re-seed the fields whenever a different row is opened.
  const [seeded, setSeeded] = useState<string | null>(null);
  const key = category?.id ?? "new";
  if (open && seeded !== key) {
    setSeeded(key);
    setName(category?.name ?? "");
    setSlug(category?.slug ?? "");
    setDescription(category?.description ?? "");
    setFeatured(category?.featured ?? false);
    setActive(category?.active ?? true);
    setError(null);
  }

  const save = useAction(
    async () => {
      const payload = {
        name: name.trim(),
        slug: slug.trim() || undefined,
        description: description.trim() || undefined,
        featured,
        active,
      };
      return category
        ? api.patch(`/api/v1/admin/categories/${category.id}`, payload)
        : api.post("/api/v1/admin/categories", payload);
    },
    {
      onSuccess: () => {
        toast({ tone: "success", title: category ? "دسته‌بندی ویرایش شد" : "دسته‌بندی ایجاد شد" });
        onDone();
      },
    }
  );

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError("نام دسته‌بندی را وارد کنید.");
      return;
    }
    setError(null);
    void save.run();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={category ? "ویرایش دسته‌بندی" : "افزودن دسته‌بندی"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={save.pending}>انصراف</Button>
          <Button type="submit" form="category-form" loading={save.pending} disabled={save.pending}>
            ذخیره
          </Button>
        </div>
      }
    >
      <form id="category-form" onSubmit={submit} noValidate className="space-y-4" aria-busy={save.pending}>
        <Input
          label="نام"
          required
          value={name}
          onChange={(e) => { setName(e.target.value); setError(null); }}
          error={error ?? undefined}
          disabled={save.pending}
        />
        <Input
          label="نشانی (slug)"
          dir="ltr"
          className="[&_input]:text-start"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          hint="خالی بگذارید تا از روی نام ساخته شود."
          disabled={save.pending}
        />
        <Textarea
          label="توضیحات"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={save.pending}
        />
        <Checkbox
          label="نمایش در دسته‌بندی‌های منتخب صفحه اصلی"
          checked={featured}
          onChange={(e) => setFeatured(e.target.checked)}
          disabled={save.pending}
        />
        <Checkbox
          label="فعال (نمایش در فروشگاه)"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          disabled={save.pending}
        />
        {save.error && <Alert tone="danger" role="alert">{save.error}</Alert>}
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Colours                                                                     */
/* -------------------------------------------------------------------------- */

export function ColorManager({ colors }: { colors: ColorRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [hex, setHex] = useState("#1A1A1C");
  const [error, setError] = useState<string | null>(null);

  const create = useAction(
    async () => api.post("/api/v1/admin/colors", { name: name.trim(), hex }),
    {
      onSuccess: () => {
        toast({ tone: "success", title: "رنگ اضافه شد" });
        setOpen(false);
        setName("");
        router.refresh();
      },
    }
  );

  const remove = useAction(
    async (id: string) => api.delete<{ action: string; message: string }>(`/api/v1/admin/colors/${id}`),
    {
      onSuccess: (result) => {
        toast({
          tone: result.action === "deleted" ? "success" : "info",
          title: result.action === "deleted" ? "رنگ حذف شد" : "رنگ غیرفعال شد",
          description: result.message,
        });
        router.refresh();
      },
      onError: (message) => toast({ tone: "error", title: "حذف انجام نشد", description: message }),
    }
  );

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-fg">رنگ‌ها</h2>
          <p className="mt-1 text-xs text-fg-muted">
            رنگ‌ها بین همه محصولات مشترک‌اند و هنگام ساخت تنوع استفاده می‌شوند.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)} icon={<Plus className="size-4" aria-hidden />}>
          افزودن رنگ
        </Button>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {colors.map((color) => (
          <li
            key={color.id}
            className={cn(
              "flex items-center gap-3 rounded-md border border-border p-2.5",
              !color.active && "opacity-60"
            )}
          >
            <span
              aria-hidden
              className="size-8 shrink-0 rounded-md border border-border"
              style={{ background: color.hex }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-fg">
                {color.name}
                {!color.active && <span className="ms-1.5 text-xs text-fg-subtle">(غیرفعال)</span>}
              </p>
              <p className="tnum text-xs text-fg-subtle" dir="ltr">
                {color.hex} — {toPersianDigits(color.productCount)} محصول
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const message =
                  color.productCount > 0
                    ? `رنگ «${color.name}» در ${toPersianDigits(color.productCount)} محصول استفاده شده و به‌جای حذف، غیرفعال می‌شود. ادامه می‌دهید؟`
                    : `رنگ «${color.name}» حذف شود؟`;
                if (confirm(message)) void remove.run(color.id);
              }}
              disabled={remove.pending}
              aria-label={`حذف ${color.name}`}
              className="grid size-9 shrink-0 place-items-center rounded-md text-fg-subtle hover:bg-danger-soft hover:text-danger disabled:opacity-50"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="افزودن رنگ"
        description="رنگ تازه در فهرست مشترک فروشگاه ثبت می‌شود."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={create.pending}>انصراف</Button>
            <Button type="submit" form="color-form" loading={create.pending} disabled={create.pending}>
              افزودن
            </Button>
          </div>
        }
      >
        <form
          id="color-form"
          noValidate
          className="space-y-4"
          aria-busy={create.pending}
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim().length < 1) { setError("نام رنگ را وارد کنید."); return; }
            setError(null);
            void create.run();
          }}
        >
          <Input
            label="نام رنگ"
            required
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            error={error ?? undefined}
            placeholder="مثلاً: سرمه‌ای"
            disabled={create.pending}
          />
          <div>
            <label htmlFor="color-hex" className="mb-1.5 block text-sm font-medium text-fg">
              کد رنگ
            </label>
            <div className="flex items-center gap-3">
              <input
                id="color-hex"
                type="color"
                value={hex}
                onChange={(e) => setHex(e.target.value)}
                disabled={create.pending}
                className="h-11 w-16 cursor-pointer rounded-md border border-border-strong bg-surface p-1"
              />
              <input
                type="text"
                dir="ltr"
                value={hex}
                onChange={(e) => setHex(e.target.value)}
                disabled={create.pending}
                className="tnum h-11 flex-1 rounded-md border border-border-strong bg-surface px-3 text-start text-sm
                           focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
            </div>
          </div>
          {create.error && <Alert tone="danger" role="alert">{create.error}</Alert>}
        </form>
      </Modal>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Sizes                                                                       */
/* -------------------------------------------------------------------------- */

export function SizeManager({ sizes }: { sizes: SizeRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = useState("");

  const create = useAction(
    async () => api.post("/api/v1/admin/sizes", { value: Number(value) }),
    {
      onSuccess: () => {
        toast({ tone: "success", title: "سایز اضافه شد" });
        setValue("");
        router.refresh();
      },
      onError: (message) => toast({ tone: "error", title: "افزودن انجام نشد", description: message }),
    }
  );

  const remove = useAction(
    async (id: string) => api.delete<{ action: string; message: string }>(`/api/v1/admin/sizes/${id}`),
    {
      onSuccess: (result) => {
        toast({
          tone: result.action === "deleted" ? "success" : "info",
          title: result.action === "deleted" ? "سایز حذف شد" : "سایز غیرفعال شد",
          description: result.message,
        });
        router.refresh();
      },
      onError: (message) => toast({ tone: "error", title: "حذف انجام نشد", description: message }),
    }
  );

  return (
    <Card>
      <h2 className="font-bold text-fg">سایزها</h2>
      <p className="mt-1 text-xs text-fg-muted">
        سایزهای اروپایی مشترک فروشگاه. سایزی که در محصولی استفاده شده، حذف نمی‌شود بلکه غیرفعال
        می‌شود.
      </p>

      <ul className="mt-3 flex flex-wrap gap-2">
        {sizes.map((size) => (
          <li key={size.id} className="group relative">
            <span
              className={cn(
                "tnum inline-flex h-11 items-center gap-1.5 rounded-md border px-3 text-sm",
                size.active
                  ? "border-border bg-surface text-fg"
                  : "border-border bg-surface-2 text-fg-subtle line-through"
              )}
            >
              {toPersianDigits(size.label)}
              <span className="text-xs text-fg-subtle">({toPersianDigits(size.variantCount)})</span>
              <button
                type="button"
                onClick={() => {
                  const message =
                    size.variantCount > 0
                      ? `سایز ${size.label} در ${toPersianDigits(size.variantCount)} تنوع استفاده شده و به‌جای حذف، غیرفعال می‌شود. ادامه می‌دهید؟`
                      : `سایز ${size.label} حذف شود؟`;
                  if (confirm(message)) void remove.run(size.id);
                }}
                disabled={remove.pending}
                aria-label={`حذف سایز ${size.label}`}
                className="grid size-5 place-items-center rounded text-fg-subtle hover:text-danger disabled:opacity-50"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </span>
          </li>
        ))}
      </ul>

      <form
        className="mt-4 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!value) return;
          void create.run();
        }}
        aria-busy={create.pending}
      >
        <Input
          label="سایز تازه"
          dir="ltr"
          inputMode="numeric"
          className="w-32 [&_input]:text-start"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
          placeholder="42"
          disabled={create.pending}
        />
        <Button
          type="submit"
          variant="secondary"
          loading={create.pending}
          disabled={create.pending || !value}
          icon={<Plus className="size-4" aria-hidden />}
        >
          افزودن
        </Button>
      </form>
    </Card>
  );
}
