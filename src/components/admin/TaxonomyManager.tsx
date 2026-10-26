"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ChevronDown, ChevronUp, CornerDownLeft, Eye, EyeOff, FolderPlus, ImageIcon, Pencil, Plus, Trash2,
} from "lucide-react";
import {
  MAX_CATEGORY_DEPTH, buildCategoryTree, descendantIds, flattenCategoryTree, subtreeHeight,
  type CategoryNode,
} from "@/lib/category-tree";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { isLocalUpload } from "@/lib/media";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Overlay";
import { Input, Select, Textarea } from "@/components/ui/Input";
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
 * Category deletion is confirmed in a modal; colour and size deletion keep the
 * browser confirm, which is enough for those small, non-visual vocabularies.
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
  /** Shown as the subtitle under the title on the homepage card. */
  description?: string;
  image?: string;
  featured?: boolean;
  active?: boolean;
  /** Parent category; absent for a top-level category. */
  parentId?: string;
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
  // `creating` holds the parent for a new category ("" = top level).
  const [creating, setCreating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CategoryNode<CategoryRow> | null>(null);
  // Optimistic sibling order per parent ("" = top level) so the arrows respond
  // instantly; cleared whenever fresh rows arrive from the server.
  const [orders, setOrders] = useState<Record<string, string[]>>({});
  const [seenRows, setSeenRows] = useState(categories);
  if (seenRows !== categories) {
    setSeenRows(categories);
    setOrders({});
  }

  const tree = useMemo(() => {
    const applyOrder = (nodes: CategoryNode<CategoryRow>[], parent: string): CategoryNode<CategoryRow>[] => {
      const order = orders[parent];
      const sorted = order ? [...nodes].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)) : nodes;
      return sorted.map((n) => ({ ...n, children: applyOrder(n.children, n.id) }));
    };
    return applyOrder(buildCategoryTree(categories), "");
  }, [categories, orders]);

  const remove = useAction(
    async (id: string) =>
      api.delete<{ action: string; message: string }>(`/api/v1/admin/categories/${id}`),
    {
      onSuccess: (result) => {
        setDeleting(null);
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

  const toggle = useAction(
    async (category: CategoryRow) =>
      api.patch(`/api/v1/admin/categories/${category.id}`, { active: category.active === false }),
    {
      onSuccess: () => router.refresh(),
      onError: (message) => toast({ tone: "error", title: "تغییر انجام نشد", description: message }),
    }
  );

  const reorder = useAction(
    async (ids: string[]) => api.post("/api/v1/admin/categories/reorder", { ids }),
    {
      onSuccess: () => { router.refresh(); },
      onError: (message) => {
        setOrders({});
        toast({ tone: "error", title: "ترتیب ذخیره نشد", description: message });
      },
    }
  );

  const move = (siblings: CategoryRow[], index: number, to: number) => {
    if (to < 0 || to >= siblings.length) return;
    const ids = siblings.map((c) => c.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(to, 0, moved);
    setOrders((o) => ({ ...o, [siblings[0].parentId ?? ""]: ids }));
    void reorder.run(ids);
  };

  const renderLevel = (nodes: CategoryNode<CategoryRow>[]): React.ReactNode => (
    <ul className={cn(nodes[0]?.depth ? "border-s-2 border-border/70" : "divide-y divide-border")}>
      {nodes.map((category, index) => (
        <li key={category.id}>
          <div
            className={cn("flex flex-wrap items-center gap-3 p-3 sm:p-4", category.active === false && "opacity-70")}
            style={{ paddingInlineStart: `${0.75 + category.depth * 1.25}rem` }}
          >
            <ReorderButtons
              label={category.name}
              first={index === 0}
              last={index === nodes.length - 1}
              disabled={reorder.pending}
              onUp={() => move(nodes, index, index - 1)}
              onDown={() => move(nodes, index, index + 1)}
            />
            <CardThumb src={category.image} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium text-fg">
                {category.depth > 0 && <CornerDownLeft className="size-3.5 text-fg-subtle" aria-hidden />}
                {category.name}
                {category.depth === 0 ? (
                  <Badge tone="neutral" size="sm">دسته اصلی</Badge>
                ) : (
                  <Badge tone="neutral" size="sm">زیردسته سطح {toPersianDigits(category.depth)}</Badge>
                )}
                {category.featured && <Badge tone="info" size="sm">صفحه اصلی</Badge>}
                {category.active === false && <Badge tone="neutral" size="sm">غیرفعال</Badge>}
              </p>
              <p className="mt-0.5 text-xs text-fg-subtle" dir="ltr">/category/{category.slug}</p>
              {category.description && (
                <p className="mt-1 line-clamp-1 text-xs text-fg-muted">{category.description}</p>
              )}
            </div>

            <span className="tnum whitespace-nowrap text-xs text-fg-muted">
              {toPersianDigits(category.productCount)} محصول
              {category.children.length > 0 && ` · ${toPersianDigits(category.children.length)} زیردسته`}
            </span>

            <div className="flex gap-1">
              {category.depth < MAX_CATEGORY_DEPTH - 1 && (
                <button
                  type="button"
                  onClick={() => setCreating(category.id)}
                  aria-label={`افزودن زیردسته به ${category.name}`}
                  title="افزودن زیردسته"
                  className="grid size-9 place-items-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-fg"
                >
                  <FolderPlus className="size-4" aria-hidden />
                </button>
              )}
              <VisibilityButton
                visible={category.active !== false}
                label={category.name}
                disabled={toggle.pending}
                onClick={() => void toggle.run(category)}
              />
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
                onClick={() => setDeleting(category)}
                disabled={remove.pending}
                aria-label={`حذف ${category.name}`}
                className="grid size-9 place-items-center rounded-md text-fg-subtle hover:bg-danger-soft hover:text-danger disabled:opacity-50"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          </div>
          {category.children.length > 0 && renderLevel(category.children)}
        </li>
      ))}
    </ul>
  );

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="font-bold text-fg">دسته‌بندی‌ها و زیردسته‌ها</h2>
          <p className="mt-1 text-xs text-fg-muted">
            برای ساخت زیردسته، دکمه پوشه کنار هر دسته را بزنید. برای جابه‌جایی یک زیردسته، آن را
            ویرایش کنید و «دسته‌بندی والد» را تغییر دهید. ترتیب هر سطح با فلش‌ها تنظیم می‌شود.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating("")} icon={<Plus className="size-4" aria-hidden />}>
          افزودن دسته اصلی
        </Button>
      </div>

      {tree.length > 0 && renderLevel(tree)}

      {categories.length === 0 && (
        <p className="p-6 text-center text-sm text-fg-muted">هنوز دسته‌بندی‌ای تعریف نشده است.</p>
      )}

      <CategoryModal
        open={creating !== null || editing !== null}
        category={editing}
        defaultParentId={creating ?? ""}
        categories={categories}
        onClose={() => { setCreating(null); setEditing(null); }}
        onDone={() => { setCreating(null); setEditing(null); router.refresh(); }}
      />

      <ConfirmDeleteModal
        open={deleting !== null}
        title="حذف دسته‌بندی"
        pending={remove.pending}
        blocked={(deleting?.children.length ?? 0) > 0}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && void remove.run(deleting.id)}
        message={
          !deleting
            ? ""
            : deleting.children.length > 0
              ? `«${deleting.name}» ${toPersianDigits(deleting.children.length)} زیردسته دارد. برای حفظ ساختار، ابتدا زیردسته‌ها را (با ویرایش و تغییر «دسته‌بندی والد») به دسته دیگری منتقل یا حذف کنید.`
              : deleting.productCount > 0
                ? `«${deleting.name}» ${toPersianDigits(deleting.productCount)} محصول دارد. به‌جای حذف، غیرفعال می‌شود و از فروشگاه برداشته می‌شود؛ محصول‌ها حذف نمی‌شوند.`
                : `دسته‌بندی «${deleting.name}» برای همیشه حذف شود؟`
        }
      />
    </Card>
  );
}

function CategoryModal({
  open, category, defaultParentId, categories, onClose, onDone,
}: {
  open: boolean;
  category: CategoryRow | null;
  /** Parent preselected for a new category ("" = top level). */
  defaultParentId: string;
  categories: CategoryRow[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [image, setImage] = useState<string[]>(category?.image ? [category.image] : []);
  const [uploading, setUploading] = useState(false);
  const [featured, setFeatured] = useState(category?.featured ?? true);
  const [active, setActive] = useState(category?.active ?? true);
  const [parentId, setParentId] = useState(category?.parentId ?? defaultParentId);
  const [error, setError] = useState<string | null>(null);

  // Re-seed the fields whenever a different row is opened.
  const [seeded, setSeeded] = useState<string | null>(null);
  const key = category?.id ?? `new:${defaultParentId}`;
  if (open && seeded !== key) {
    setSeeded(key);
    setName(category?.name ?? "");
    setSlug(category?.slug ?? "");
    setDescription(category?.description ?? "");
    setImage(category?.image ? [category.image] : []);
    // A new top-level category defaults to the homepage tiles, so creating
    // one is enough to see it; a new subcategory does not crowd them.
    setFeatured(category?.featured ?? !defaultParentId);
    setActive(category?.active ?? true);
    setParentId(category?.parentId ?? defaultParentId);
    setError(null);
  }
  if (!open && seeded !== null) setSeeded(null);

  // Possible parents: never the category itself or anything under it (a
  // cycle), and only where the whole moved subtree still fits the depth limit.
  const parentOptions = useMemo(() => {
    const blocked = category ? new Set(descendantIds(categories, category.id)) : new Set<string>();
    const height = category ? subtreeHeight(categories, category.id) : 0;
    return flattenCategoryTree(buildCategoryTree(categories))
      .filter((c) => !blocked.has(c.id) && c.depth + 1 + height < MAX_CATEGORY_DEPTH)
      .map((c) => ({ value: c.id, label: `${"— ".repeat(c.depth)}${c.name}` }));
  }, [categories, category]);

  const save = useAction(
    async () => {
      const payload = {
        name: name.trim(),
        slug: slug.trim() || undefined,
        // Empty strings clear the stored values on edit.
        description: description.trim(),
        image: image[0] ?? "",
        featured,
        active,
        parentId: parentId || null,
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

  const parentName = categories.find((c) => c.id === parentId)?.name;
  const title = category
    ? "ویرایش دسته‌بندی"
    : defaultParentId
      ? `افزودن زیردسته به «${categories.find((c) => c.id === defaultParentId)?.name ?? ""}»`
      : "افزودن دسته اصلی";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={save.pending}>انصراف</Button>
          <Button type="submit" form="category-form" loading={save.pending} disabled={save.pending || uploading}>
            ذخیره
          </Button>
        </div>
      }
    >
      <form id="category-form" onSubmit={submit} noValidate className="space-y-4" aria-busy={save.pending}>
        <Input
          label="عنوان"
          required
          value={name}
          onChange={(e) => { setName(e.target.value); if (error) setError(null); }}
          error={error ?? undefined}
          disabled={save.pending}
          autoComplete="off"
        />
        <Select
          label="دسته‌بندی والد"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          options={[{ value: "", label: "— دسته اصلی (بدون والد) —" }, ...parentOptions]}
          hint={
            parentId
              ? `زیرمجموعه «${parentName ?? ""}» نمایش داده می‌شود.`
              : "در منوی اصلی و سطح اول دسته‌بندی‌ها نمایش داده می‌شود."
          }
          disabled={save.pending}
        />
        <Textarea
          label="زیرعنوان / توضیح کوتاه"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          hint="زیر عنوان کارت دسته‌بندی در صفحه اصلی نمایش داده می‌شود."
          disabled={save.pending}
        />
        <div>
          <p className="mb-1.5 text-sm font-medium text-fg">تصویر کارت</p>
          <ImageUploader
            images={image}
            onChange={setImage}
            onUploadingChange={setUploading}
            folder="categories"
            max={1}
            disabled={save.pending}
            hint="پیش‌نمایش پیش از ذخیره نمایش داده می‌شود. بدون تصویر، عکس پرفروش‌ترین محصول همین دسته استفاده می‌شود."
          />
        </div>
        <Input
          label="نشانی (slug)"
          dir="ltr"
          className="[&_input]:text-start"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          hint="خالی بگذارید تا از روی نام ساخته شود."
          disabled={save.pending}
          autoComplete="off"
        />
        <Checkbox
          label="نمایش در دسته‌بندی‌های صفحه اصلی"
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
/* Shared row controls (also used by the collection manager)                   */
/* -------------------------------------------------------------------------- */

export function ReorderButtons({
  label, first, last, disabled, onUp, onDown,
}: {
  label: string;
  first: boolean;
  last: boolean;
  disabled?: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <span className="flex flex-col">
      <button
        type="button"
        onClick={onUp}
        disabled={disabled || first}
        aria-label={`انتقال ${label} به بالا`}
        className="grid size-7 place-items-center rounded text-fg-subtle hover:bg-surface-2 hover:text-fg disabled:opacity-30"
      >
        <ChevronUp className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={disabled || last}
        aria-label={`انتقال ${label} به پایین`}
        className="grid size-7 place-items-center rounded text-fg-subtle hover:bg-surface-2 hover:text-fg disabled:opacity-30"
      >
        <ChevronDown className="size-4" aria-hidden />
      </button>
    </span>
  );
}

export function VisibilityButton({
  visible, label, disabled, onClick,
}: { visible: boolean; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={visible}
      aria-label={visible ? `پنهان کردن ${label} از فروشگاه` : `نمایش ${label} در فروشگاه`}
      title={visible ? "نمایش در فروشگاه" : "پنهان از فروشگاه"}
      className="grid size-9 place-items-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-fg disabled:opacity-50"
    >
      {visible ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
    </button>
  );
}

export function CardThumb({ src }: { src?: string }) {
  return (
    <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-surface-inset text-fg-subtle">
      {src ? (
        <Image src={src} unoptimized={isLocalUpload(src)} alt="" fill sizes="48px" className="object-cover" />
      ) : (
        <ImageIcon className="size-4" aria-hidden />
      )}
    </span>
  );
}

export function ConfirmDeleteModal({
  open, title, message, pending, onClose, onConfirm, blocked,
}: {
  open: boolean;
  title: string;
  message: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** The delete cannot go ahead; the message explains what to do first. */
  blocked?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>انصراف</Button>
          {!blocked && (
            <Button
              variant="danger"
              onClick={onConfirm}
              loading={pending}
              disabled={pending}
              icon={<Trash2 className="size-4" aria-hidden />}
            >
              تأیید
            </Button>
          )}
        </div>
      }
    >
      <p className="text-sm leading-7 text-fg">{message}</p>
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
