"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeftRight, ArrowRight, CheckSquare, Pencil, Plus, Save, Trash2, Wand2, X,
} from "lucide-react";
import { Modal } from "@/components/ui/Overlay";
import { isLocalUpload } from "@/lib/media";
import { PRODUCT_GENDERS, isProductGender } from "@/lib/catalog-constants";
import { GENDER_LABELS, TAG_LABELS } from "@/lib/shop-params";
import type { Gender } from "@/types";
import { buildCategoryTree, flattenCategoryTree } from "@/lib/category-tree";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Checkbox, Switch } from "@/components/ui/Checkbox";
import { Tabs } from "@/components/ui/Navigation";
import { Alert } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { useAction } from "@/lib/use-action";
import { slugify } from "@/lib/persian";
import { formatAmount, toPersianDigits } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProductEditorOptions } from "@/server/services/taxonomy";

/**
 * The product editor.
 *
 * Creates and edits a whole product in one submission — identity, categories,
 * colourways with their galleries, and the variant matrix. The server writes it
 * all in a single transaction, so a half-saved product is never visible.
 *
 * The variant matrix is the part worth understanding: a product's variants are
 * the (colour × size) pairs the shop actually stocks. The editor builds that
 * grid from the chosen colours and sizes, and refuses to produce a duplicate
 * pair — which the database also enforces with a unique constraint.
 *
 * Colourways are identified by a stable row key (the database row id once
 * saved), never by their colour. That is what lets "Edit colour" turn
 * Black into Burgundy while keeping the same gallery, stock and prices, and
 * what keeps each colourway's uploader mounted — React keys on the row, so
 * nothing remounts while the operator types or edits.
 */

export interface ProductDraft {
  id?: string;
  name: string;
  slug: string;
  subtitle: string;
  brandId: string;
  categoryIds: string[];
  /** Empty until chosen. Legacy `unisex` / `kids` load but cannot be saved. */
  gender: Gender | "";
  price: number;
  compareAtPrice: number | null;
  description: string;
  features: string[];
  specs: { label: string; value: string }[];
  tags: string[];
  active: boolean;
  /** `id` is the saved colourway row; `key` is the editor's stable handle. */
  colors: { id?: string; key?: string; colorId: string; images: string[] }[];
  variants: {
    id?: string;
    colorId: string;
    size: number;
    sku?: string;
    stock: number;
    price?: number | null;
    compareAtPrice?: number | null;
    active?: boolean;
  }[];
}

const GENDERS = PRODUCT_GENDERS.map((value) => ({ value, label: GENDER_LABELS[value] }));

const TAGS = (["new", "bestseller", "sale", "limited"] as const).map((value) => ({
  value,
  label: TAG_LABELS[value],
}));

type DraftColor = ProductDraft["colors"][number] & { key: string };
type EditorDraft = Omit<ProductDraft, "colors"> & { colors: DraftColor[] };
type ColorOption = ProductEditorOptions["colors"][number];

let keySeq = 0;
const newColorKey = () => `new-${Date.now().toString(36)}-${++keySeq}`;

function withKeys(draft: ProductDraft): EditorDraft {
  return {
    ...draft,
    colors: draft.colors.map((c) => ({ ...c, key: c.key ?? c.id ?? newColorKey() })),
  };
}

export function ProductEditor({
  initial,
  options,
  mode,
}: {
  initial: ProductDraft;
  options: ProductEditorOptions;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [tab, setTab] = useState("general");
  const [draft, setDraft] = useState<EditorDraft>(() => withKeys(initial));
  // A product saved before unisex/kids were retired must be given a current
  // gender before it can be saved again; the form says so instead of failing.
  const legacyGender = initial.gender && !isProductGender(initial.gender) ? initial.gender : null;
  const [dirty, setDirty] = useState(mode === "create");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [uploadingColors, setUploadingColors] = useState<string[]>([]);
  const imagesUploading = uploadingColors.length > 0;
  const setColorUploading = (key: string, uploading: boolean) => {
    setUploadingColors((keys) => uploading
      ? keys.includes(key) ? keys : [...keys, key]
      : keys.filter((k) => k !== key));
  };

  // The shared palette, plus any colour created from inside this editor.
  const [palette, setPalette] = useState<ColorOption[]>(options.colors);
  const [editingColorKey, setEditingColorKey] = useState<string | null>(null);
  const [removingColorKey, setRemovingColorKey] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = <K extends keyof EditorDraft>(key: K, value: EditorDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
    setErrors((e) => ({ ...e, [key as string]: "" }));
  };

  const colorById = useMemo(() => new Map(palette.map((c) => [c.id, c])), [palette]);

  /* ------------------------------------------------------------- saving -- */

  const save = useAction(
    async () => {
      const payload = {
        name: draft.name.trim(),
        slug: draft.slug.trim(),
        subtitle: draft.subtitle.trim() || undefined,
        brandId: draft.brandId,
        categoryIds: draft.categoryIds,
        gender: draft.gender,
        price: draft.price,
        compareAtPrice: draft.compareAtPrice,
        description: draft.description,
        features: draft.features.filter((f) => f.trim()),
        specs: draft.specs.filter((s) => s.label.trim() && s.value.trim()),
        tags: draft.tags,
        active: draft.active,
        // The editor's row key never leaves the browser; the row id does.
        colors: draft.colors.map(({ id, colorId, images }) => ({ id, colorId, images })),
        variants: draft.variants,
      };

      return mode === "create"
        ? api.post<{ product: { id: string; slug: string } }>("/api/v1/admin/products", payload)
        : api.put<{ product: { id: string; slug: string } }>(
            `/api/v1/admin/products/${draft.id}`,
            payload
          );
    },
    {
      onSuccess: (result) => {
        setDirty(false);
        toast({
          tone: "success",
          title: mode === "create" ? "محصول ایجاد شد" : "تغییرات ذخیره شد",
        });
        if (mode === "create") router.push(`/admin/products/${result.product.slug}`);
        else router.refresh();
      },
      onError: (message) =>
        toast({ tone: "error", title: "ذخیره انجام نشد", description: message }),
    }
  );

  const submit = () => {
    if (imagesUploading) {
      setTab("media");
      return;
    }
    const next: Record<string, string> = {};
    if (draft.name.trim().length < 2) next.name = "نام محصول را وارد کنید.";
    if (!draft.slug.trim()) next.slug = "نشانی (slug) را وارد کنید.";
    if (!draft.brandId) next.brandId = "کالکشن را انتخاب کنید.";
    if (!draft.categoryIds.length) next.categoryIds = "حداقل یک دسته‌بندی انتخاب کنید.";
    if (!draft.price || draft.price <= 0) next.price = "قیمت را وارد کنید.";
    if (!isProductGender(draft.gender)) next.gender = "جنسیت را «مردانه» یا «زنانه» انتخاب کنید.";
    if (draft.compareAtPrice != null && draft.compareAtPrice <= draft.price) {
      next.compareAtPrice = "قیمت قبل از تخفیف باید بیشتر از قیمت فعلی باشد.";
    }
    if (!draft.colors.length) next.colors = "حداقل یک رنگ انتخاب کنید.";

    setErrors(next);
    if (Object.keys(next).length) {
      // Send the operator to the tab the problem is on, rather than showing an
      // error about a field they cannot see.
      if (next.colors) setTab("media");
      else setTab("general");
      return;
    }
    void save.run();
  };

  /* ------------------------------------------------------------ colours -- */

  const touchColors = () => {
    setDirty(true);
    setErrors((e) => ({ ...e, colors: "" }));
  };

  const addColor = (colorId: string) => {
    touchColors();
    setDraft((d) =>
      d.colors.some((c) => c.colorId === colorId)
        ? d
        : { ...d, colors: [...d.colors, { key: newColorKey(), colorId, images: [] }] }
    );
  };

  /**
   * Removes a colourway. With images, the operator first sees what would be
   * lost and can move the images elsewhere; without images or stock, it is a
   * harmless undo and happens at once.
   */
  const requestRemoveColor = (key: string) => {
    const color = draft.colors.find((c) => c.key === key);
    if (!color) return;
    const variants = draft.variants.filter((v) => v.colorId === color.colorId);
    if (color.images.length === 0 && variants.every((v) => v.stock === 0)) {
      removeColor(key);
      return;
    }
    setRemovingColorKey(key);
  };

  const removeColor = (key: string, moveImagesTo?: string) => {
    touchColors();
    setDraft((d) => {
      const color = d.colors.find((c) => c.key === key);
      if (!color) return d;
      const colors = d.colors
        .filter((c) => c.key !== key)
        .map((c) =>
          c.key === moveImagesTo
            ? { ...c, images: [...c.images, ...color.images.filter((url) => !c.images.includes(url))] }
            : c
        );
      return {
        ...d,
        colors,
        // Variants of a removed colour go with it; keeping them would leave
        // stock attached to a colourway the product no longer has.
        variants: d.variants.filter((v) => v.colorId !== color.colorId),
      };
    });
  };

  /**
   * Edit colour: the row keeps its key, id, gallery and variants — only the
   * colour it points at changes. The variants follow, so stock and prices per
   * size carry over unchanged.
   */
  const changeColor = (key: string, colorId: string) => {
    touchColors();
    setDraft((d) => {
      const row = d.colors.find((c) => c.key === key);
      if (!row || row.colorId === colorId) return d;
      // Never two rows on one colour; the picker already prevents it.
      if (d.colors.some((c) => c.key !== key && c.colorId === colorId)) return d;
      return {
        ...d,
        colors: d.colors.map((c) => (c.key === key ? { ...c, colorId } : c)),
        variants: d.variants.map((v) => (v.colorId === row.colorId ? { ...v, colorId } : v)),
      };
    });
  };

  /** Moves the chosen images to another colourway, keeping their order. */
  const moveImages = (fromKey: string, toKey: string, urls: string[]) => {
    if (!urls.length || fromKey === toKey) return;
    touchColors();
    setDraft((d) => ({
      ...d,
      colors: d.colors.map((c) => {
        if (c.key === fromKey) return { ...c, images: c.images.filter((url) => !urls.includes(url)) };
        if (c.key === toKey) return { ...c, images: [...c.images, ...urls.filter((url) => !c.images.includes(url))] };
        return c;
      }),
    }));
  };

  const setColorImages = (key: string, images: string[]) => {
    setDirty(true);
    setDraft((d) => ({
      ...d,
      colors: d.colors.map((c) => (c.key === key ? { ...c, images } : c)),
    }));
  };

  const remove = useAction(
    async () => api.delete<{ message: string }>(`/api/v1/admin/products/${draft.id}`),
    {
      onSuccess: (result) => {
        toast({ tone: "success", title: "محصول حذف شد", description: result.message });
        setConfirmDelete(false);
        router.push("/admin/products");
        router.refresh();
      },
      onError: (message) => toast({ tone: "error", title: "حذف انجام نشد", description: message }),
    }
  );

  /* ----------------------------------------------------------- variants -- */

  const variantKey = (colorId: string, size: number) => `${colorId}:${size}`;
  const variantMap = useMemo(
    () => new Map(draft.variants.map((v) => [variantKey(v.colorId, v.size), v])),
    [draft.variants]
  );

  const setVariantStock = (colorId: string, size: number, stock: number) => {
    setDirty(true);
    setDraft((d) => {
      const key = variantKey(colorId, size);
      const exists = d.variants.some((v) => variantKey(v.colorId, v.size) === key);
      if (exists) {
        return {
          ...d,
          variants: d.variants.map((v) =>
            variantKey(v.colorId, v.size) === key ? { ...v, stock } : v
          ),
        };
      }
      // Ticking a new cell creates the variant. The unique (product, colour,
      // size) key means it can only ever be created once.
      return { ...d, variants: [...d.variants, { colorId, size, stock, active: true }] };
    });
  };

  const removeVariant = (colorId: string, size: number) => {
    setDirty(true);
    setDraft((d) => ({
      ...d,
      variants: d.variants.filter((v) => variantKey(v.colorId, v.size) !== variantKey(colorId, size)),
    }));
  };

  /** Fills every (chosen colour × chosen size) cell that has no variant yet. */
  const fillMatrix = (sizes: number[], stock: number) => {
    setDirty(true);
    setDraft((d) => {
      const next = [...d.variants];
      for (const color of d.colors) {
        for (const size of sizes) {
          if (next.some((v) => variantKey(v.colorId, v.size) === variantKey(color.colorId, size))) {
            continue;
          }
          next.push({ colorId: color.colorId, size, stock, active: true });
        }
      }
      return { ...d, variants: next };
    });
  };

  const usedSizes = useMemo(
    () => [...new Set(draft.variants.map((v) => v.size))].sort((a, b) => a - b),
    [draft.variants]
  );

  const totalStock = draft.variants.reduce((n, v) => n + v.stock, 0);

  return (
    <>
      <Link href="/admin/products" className="mb-4 inline-flex min-h-9 items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowRight className="size-4" aria-hidden />
        بازگشت به محصولات
      </Link>

      <AdminPageHeader
        title={mode === "create" ? "افزودن محصول" : draft.name || "ویرایش محصول"}
        description={
          mode === "create"
            ? "اطلاعات محصول، رنگ‌ها و موجودی هر سایز را وارد کنید."
            : `${toPersianDigits(draft.variants.length)} تنوع — مجموع موجودی ${toPersianDigits(totalStock)} عدد`
        }
        actions={
          <>
            <Switch
              checked={draft.active}
              onChange={(value) => set("active", value)}
              label={draft.active ? "فعال" : "غیرفعال"}
              disabled={save.pending}
            />
            {mode === "edit" && draft.id && (
              <Button
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                disabled={save.pending || remove.pending}
                icon={<Trash2 className="size-4" aria-hidden />}
                className="text-danger hover:bg-danger-soft"
              >
                حذف محصول
              </Button>
            )}
            <Button
              onClick={submit}
              loading={save.pending}
              disabled={save.pending || imagesUploading || (!dirty && mode === "edit")}
              icon={<Save className="size-4" aria-hidden />}
            >
              {mode === "create" ? "ایجاد محصول" : "ذخیره تغییرات"}
            </Button>
          </>
        }
      />

      {imagesUploading && (
        <Alert tone="info" role="status" className="mb-4">آپلود تصاویر هنوز تمام نشده است؛ پس از اتمام می‌توانید محصول را ذخیره کنید.</Alert>
      )}
      {save.error && <Alert tone="danger" role="alert" className="mb-4">{save.error}</Alert>}

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "general", label: "اطلاعات کلی" },
          { value: "media", label: "رنگ‌ها و تصاویر" },
          { value: "inventory", label: "موجودی و تنوع" },
          { value: "details", label: "مشخصات فنی" },
        ]}
      />

      {/* ------------------------------------------------------- general -- */}
      {tab === "general" && (
        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr] xl:items-start">
          <Card className="space-y-4">
            <Input
              label="نام محصول"
              required
              value={draft.name}
              onChange={(e) => {
                set("name", e.target.value);
                // The slug follows the name until the operator edits it.
                if (!slugTouched) setDraft((d) => ({ ...d, slug: slugify(e.target.value) }));
              }}
              error={errors.name || undefined}
              disabled={save.pending}
            />
            <Input
              label="نشانی (slug)"
              required
              dir="ltr"
              className="[&_input]:text-start"
              value={draft.slug}
              onChange={(e) => { setSlugTouched(true); set("slug", e.target.value); }}
              error={errors.slug || undefined}
              hint={`/product/${draft.slug || "…"}`}
              disabled={save.pending}
            />
            <Input
              label="زیرعنوان"
              value={draft.subtitle}
              onChange={(e) => set("subtitle", e.target.value)}
              disabled={save.pending}
            />
            <Textarea
              label="توضیحات"
              rows={6}
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              disabled={save.pending}
            />
          </Card>

          <div className="space-y-4">
            <Card className="space-y-4">
              <Input
                label="قیمت (تومان)"
                required
                dir="ltr"
                inputMode="numeric"
                className="[&_input]:text-start"
                value={draft.price ? String(draft.price) : ""}
                onChange={(e) => set("price", Number(e.target.value.replace(/\D/g, "")) || 0)}
                error={errors.price || undefined}
                hint={draft.price ? `${formatAmount(draft.price)} تومان` : undefined}
                disabled={save.pending}
              />
              <Input
                label="قیمت قبل از تخفیف"
                dir="ltr"
                inputMode="numeric"
                className="[&_input]:text-start"
                value={draft.compareAtPrice ? String(draft.compareAtPrice) : ""}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  set("compareAtPrice", digits ? Number(digits) : null);
                }}
                error={errors.compareAtPrice || undefined}
                hint="خالی بگذارید اگر محصول تخفیف ندارد."
                disabled={save.pending}
              />
              <Select
                label="کالکشن"
                required
                value={draft.brandId}
                onChange={(e) => set("brandId", e.target.value)}
                options={options.brands.map((b) => ({ value: b.id, label: b.name }))}
                placeholder="انتخاب کنید"
                error={errors.brandId || undefined}
                disabled={save.pending}
              />
              <Select
                label="جنسیت"
                required
                value={isProductGender(draft.gender) ? draft.gender : ""}
                onChange={(e) => set("gender", e.target.value as ProductDraft["gender"])}
                options={GENDERS}
                placeholder="انتخاب کنید"
                error={errors.gender || undefined}
                hint={
                  legacyGender && !isProductGender(draft.gender)
                    ? `جنسیت قبلی این محصول («${GENDER_LABELS[legacyGender]}») دیگر استفاده نمی‌شود؛ مردانه یا زنانه را انتخاب کنید.`
                    : undefined
                }
                disabled={save.pending}
              />
            </Card>

            <Card>
              <h2 className="mb-3 font-bold text-fg">
                دسته‌بندی <span className="text-primary" aria-hidden>*</span>
              </h2>
              <div className="-my-1">
                {/* Indented by depth, so a subcategory reads as part of its parent. */}
                {flattenCategoryTree(buildCategoryTree(options.categories)).map((category) => (
                  <Checkbox
                    key={category.id}
                    className={["", "ms-5", "ms-10"][category.depth]}
                    label={category.depth ? `↳ ${category.name}` : category.name}
                    checked={draft.categoryIds.includes(category.id)}
                    onChange={(e) =>
                      set(
                        "categoryIds",
                        e.target.checked
                          ? [...draft.categoryIds, category.id]
                          : draft.categoryIds.filter((id) => id !== category.id)
                      )
                    }
                    disabled={save.pending}
                  />
                ))}
              </div>
              {errors.categoryIds && (
                <p role="alert" className="mt-2 text-sm text-danger">{errors.categoryIds}</p>
              )}
            </Card>

            <Card>
              <h2 className="mb-3 font-bold text-fg">برچسب‌ها</h2>
              <div className="flex flex-wrap gap-2">
                {TAGS.map((tag) => {
                  const active = draft.tags.includes(tag.value);
                  return (
                    <button
                      key={tag.value}
                      type="button"
                      onClick={() =>
                        set(
                          "tags",
                          active
                            ? draft.tags.filter((t) => t !== tag.value)
                            : [...draft.tags, tag.value]
                        )
                      }
                      aria-pressed={active}
                      disabled={save.pending}
                      className={cn(
                        "inline-flex min-h-9 items-center rounded-md border px-3 text-xs font-medium transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-fg"
                          : "border-border bg-surface text-fg-muted hover:text-fg"
                      )}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- media -- */}
      {tab === "media" && (
        <div className="space-y-4">
          <Card>
            <h2 className="mb-1 font-bold text-fg">
              رنگ‌های محصول <span className="text-primary" aria-hidden>*</span>
            </h2>
            <p className="mb-3 text-xs text-fg-muted">
              برای افزودن رنگ روی آن بزنید. اگر رنگی را اشتباه انتخاب کرده‌اید، در کارت همان رنگ
              «ویرایش رنگ» را بزنید تا تصاویر و موجودی آن حفظ شود. رنگ تازه را هم می‌توانید از همان
              پنجره یا از{" "}
              <Link href="/admin/categories" className="text-primary hover:underline">
                مدیریت رنگ‌ها
              </Link>{" "}
              بسازید.
            </p>
            <div className="flex flex-wrap gap-2">
              {palette.filter((c) => c.active !== false).map((color) => {
                const row = draft.colors.find((c) => c.colorId === color.id);
                return (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => (row ? requestRemoveColor(row.key) : addColor(color.id))}
                    aria-pressed={Boolean(row)}
                    aria-label={row ? `حذف رنگ ${color.name}` : `افزودن رنگ ${color.name}`}
                    disabled={save.pending}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm transition-colors",
                      row
                        ? "border-primary bg-primary-soft text-fg"
                        : "border-border bg-surface text-fg-muted hover:text-fg"
                    )}
                  >
                    <span
                      aria-hidden
                      className="size-4 rounded-full border border-border"
                      style={{ background: color.hex }}
                    />
                    {color.name}
                    {row && <X className="size-3.5 opacity-60" aria-hidden />}
                  </button>
                );
              })}
            </div>
            {errors.colors && (
              <p role="alert" className="mt-2 text-sm text-danger">{errors.colors}</p>
            )}
          </Card>

          {draft.colors.map((color) => (
            <ColorGalleryCard
              // The row key, never the colour: editing the colour must not
              // remount the uploader or drop an upload in progress.
              key={color.key}
              color={color}
              info={colorById.get(color.colorId)}
              others={draft.colors
                .filter((c) => c.key !== color.key)
                .map((c) => ({ key: c.key, name: colorById.get(c.colorId)?.name ?? c.colorId, hex: colorById.get(c.colorId)?.hex }))}
              disabled={save.pending}
              onImagesChange={(images) => setColorImages(color.key, images)}
              onUploadingChange={(uploading) => setColorUploading(color.key, uploading)}
              onEdit={() => setEditingColorKey(color.key)}
              onRemove={() => requestRemoveColor(color.key)}
              onMove={(toKey, urls) => {
                moveImages(color.key, toKey, urls);
                toast({
                  tone: "success",
                  title: `${toPersianDigits(urls.length)} تصویر منتقل شد`,
                  description: "برای ثبت نهایی، تغییرات را ذخیره کنید.",
                });
              }}
            />
          ))}

          {draft.colors.length === 0 && (
            <Card>
              <p className="py-6 text-center text-sm text-fg-muted">
                ابتدا حداقل یک رنگ انتخاب کنید تا بتوانید تصاویر آن را بارگذاری کنید.
              </p>
            </Card>
          )}
        </div>
      )}

      {/* ----------------------------------------------------- inventory -- */}
      {tab === "inventory" && (
        <VariantMatrix
          draft={draft}
          options={options}
          usedSizes={usedSizes}
          variantMap={variantMap}
          colorById={colorById}
          disabled={save.pending}
          onSetStock={setVariantStock}
          onRemove={removeVariant}
          onFill={fillMatrix}
        />
      )}

      {/* ------------------------------------------------------- details -- */}
      {tab === "details" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 font-bold text-fg">ویژگی‌ها</h2>
            <p className="mb-3 text-xs text-fg-muted">
              هر ویژگی به‌صورت یک خط در صفحه محصول نمایش داده می‌شود.
            </p>
            <ul className="space-y-2">
              {draft.features.map((feature, index) => (
                <li key={index} className="flex gap-2">
                  <input
                    value={feature}
                    onChange={(e) => {
                      const next = [...draft.features];
                      next[index] = e.target.value;
                      set("features", next);
                    }}
                    disabled={save.pending}
                    className="h-11 flex-1 rounded-md border border-border-strong bg-surface px-3 text-sm
                               focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                  />
                  <button
                    type="button"
                    onClick={() => set("features", draft.features.filter((_, i) => i !== index))}
                    aria-label={`حذف ویژگی ${index + 1}`}
                    className="grid size-11 shrink-0 place-items-center rounded-md text-fg-subtle hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => set("features", [...draft.features, ""])}
              disabled={save.pending}
              icon={<Plus className="size-4" aria-hidden />}
            >
              افزودن ویژگی
            </Button>
          </Card>

          <Card>
            <h2 className="mb-3 font-bold text-fg">مشخصات فنی</h2>
            <p className="mb-3 text-xs text-fg-muted">
              جدول مشخصات در صفحه محصول از اینجا ساخته می‌شود.
            </p>
            <ul className="space-y-2">
              {draft.specs.map((spec, index) => (
                <li key={index} className="flex gap-2">
                  <input
                    value={spec.label}
                    placeholder="عنوان"
                    onChange={(e) => {
                      const next = [...draft.specs];
                      next[index] = { ...next[index], label: e.target.value };
                      set("specs", next);
                    }}
                    disabled={save.pending}
                    className="h-11 w-2/5 rounded-md border border-border-strong bg-surface px-3 text-sm
                               focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                  />
                  <input
                    value={spec.value}
                    placeholder="مقدار"
                    onChange={(e) => {
                      const next = [...draft.specs];
                      next[index] = { ...next[index], value: e.target.value };
                      set("specs", next);
                    }}
                    disabled={save.pending}
                    className="h-11 flex-1 rounded-md border border-border-strong bg-surface px-3 text-sm
                               focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                  />
                  <button
                    type="button"
                    onClick={() => set("specs", draft.specs.filter((_, i) => i !== index))}
                    aria-label={`حذف مشخصه ${index + 1}`}
                    className="grid size-11 shrink-0 place-items-center rounded-md text-fg-subtle hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => set("specs", [...draft.specs, { label: "", value: "" }])}
              disabled={save.pending}
              icon={<Plus className="size-4" aria-hidden />}
            >
              افزودن مشخصه
            </Button>
          </Card>
        </div>
      )}

      <EditColorModal
        open={editingColorKey !== null}
        row={draft.colors.find((c) => c.key === editingColorKey) ?? null}
        palette={palette}
        usedColorIds={draft.colors.filter((c) => c.key !== editingColorKey).map((c) => c.colorId)}
        onClose={() => setEditingColorKey(null)}
        onCreated={(color) => setPalette((list) => [...list, color])}
        onPick={(colorId) => {
          const row = draft.colors.find((c) => c.key === editingColorKey);
          if (row) {
            const from = colorById.get(row.colorId)?.name;
            const to = (colorById.get(colorId) ?? palette.find((c) => c.id === colorId))?.name;
            changeColor(row.key, colorId);
            toast({
              tone: "success",
              title: "رنگ تغییر کرد",
              description: `«${from ?? ""}» به «${to ?? ""}» تغییر کرد؛ تصاویر و موجودی حفظ شدند. برای ثبت، ذخیره کنید.`,
            });
          }
          setEditingColorKey(null);
        }}
      />

      <RemoveColorModal
        open={removingColorKey !== null}
        row={draft.colors.find((c) => c.key === removingColorKey) ?? null}
        name={(() => {
          const row = draft.colors.find((c) => c.key === removingColorKey);
          return row ? colorById.get(row.colorId)?.name ?? "" : "";
        })()}
        variantCount={(() => {
          const row = draft.colors.find((c) => c.key === removingColorKey);
          return row ? draft.variants.filter((v) => v.colorId === row.colorId).length : 0;
        })()}
        others={draft.colors
          .filter((c) => c.key !== removingColorKey)
          .map((c) => ({ key: c.key, name: colorById.get(c.colorId)?.name ?? c.colorId }))}
        onClose={() => setRemovingColorKey(null)}
        onConfirm={(moveTo) => {
          if (removingColorKey) removeColor(removingColorKey, moveTo);
          setRemovingColorKey(null);
          toast({
            tone: "info",
            title: moveTo ? "تصاویر منتقل و رنگ حذف شد" : "رنگ حذف شد",
            description: "برای ثبت نهایی، تغییرات را ذخیره کنید.",
          });
        }}
      />

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="حذف محصول"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={remove.pending}>
              انصراف
            </Button>
            <Button
              variant="danger"
              onClick={() => void remove.run()}
              loading={remove.pending}
              disabled={remove.pending}
              icon={<Trash2 className="size-4" aria-hidden />}
            >
              حذف برای همیشه
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-7 text-fg">
          «{draft.name}» برای همیشه حذف می‌شود و از فروشگاه، جست‌وجو، دسته‌بندی‌ها، کالکشن‌ها و
          بخش‌های صفحه اصلی برداشته می‌شود. این کار بازگشت‌پذیر نیست.
        </p>
        <p className="mt-2 text-xs leading-6 text-fg-muted">
          سفارش‌های قبلی دست‌نخورده می‌مانند. اگر فقط می‌خواهید محصول موقتاً دیده نشود، به‌جای حذف
          آن را «غیرفعال» کنید.
        </p>
      </Modal>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Colourway card, colour picker and safe removal                              */
/* -------------------------------------------------------------------------- */

/*
 * These are module-level components on purpose. Declared inside the editor,
 * they would be new component types on every render — every keystroke would
 * remount them and the mobile keyboard would close.
 */

function ColorGalleryCard({
  color, info, others, disabled, onImagesChange, onUploadingChange, onEdit, onRemove, onMove,
}: {
  color: DraftColor;
  info?: ColorOption;
  others: { key: string; name: string; hex?: string }[];
  disabled: boolean;
  onImagesChange: (images: string[]) => void;
  onUploadingChange: (uploading: boolean) => void;
  onEdit: () => void;
  onRemove: () => void;
  onMove: (toKey: string, urls: string[]) => void;
}) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState("");
  // Selections refer to images, which can be removed underneath them.
  const live = selected.filter((url) => color.images.includes(url));

  const stopSelecting = () => { setSelecting(false); setSelected([]); setTarget(""); };

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-2 font-bold text-fg">
          <span
            aria-hidden
            className="size-4 shrink-0 rounded-full border border-border"
            style={{ background: info?.hex }}
          />
          <span className="truncate">گالری رنگ {info?.name ?? color.colorId}</span>
          <Badge tone="neutral" size="sm" className="tnum">
            {toPersianDigits(color.images.length)} تصویر
          </Badge>
        </h3>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="ghost" onClick={onEdit} disabled={disabled} icon={<Pencil className="size-4" aria-hidden />}>
            ویرایش رنگ
          </Button>
          {color.images.length > 0 && others.length > 0 && (
            <Button
              size="sm"
              variant={selecting ? "secondary" : "ghost"}
              onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
              disabled={disabled}
              aria-pressed={selecting}
              icon={<CheckSquare className="size-4" aria-hidden />}
            >
              {selecting ? "پایان انتخاب" : "انتقال تصاویر"}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={onRemove}
            disabled={disabled}
            className="text-danger hover:bg-danger-soft"
            icon={<Trash2 className="size-4" aria-hidden />}
          >
            حذف رنگ
          </Button>
        </div>
      </div>

      {selecting && (
        <div className="mb-3 flex flex-wrap items-end gap-2 rounded-md border border-primary/30 bg-primary-soft/40 p-3">
          <p className="w-full text-xs text-fg-muted">
            تصاویری را که اشتباه زیر این رنگ آپلود شده‌اند انتخاب کنید و رنگ مقصد را برگزینید. فایل‌ها
            دوباره آپلود نمی‌شوند.
          </p>
          <Select
            label="انتقال به رنگ"
            className="min-w-44 flex-1"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            options={others.map((o) => ({ value: o.key, label: o.name }))}
            placeholder="انتخاب رنگ مقصد"
            disabled={disabled}
          />
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setSelected(live.length === color.images.length ? [] : color.images)}
              disabled={disabled}
            >
              {live.length === color.images.length ? "لغو همه" : "انتخاب همه"}
            </Button>
            <Button
              onClick={() => { onMove(target, live); stopSelecting(); }}
              disabled={disabled || !target || live.length === 0}
              icon={<ArrowLeftRight className="size-4" aria-hidden />}
            >
              انتقال {live.length ? toPersianDigits(live.length) : ""} تصویر
            </Button>
          </div>
        </div>
      )}

      <ImageUploader
        images={color.images}
        onChange={onImagesChange}
        onUploadingChange={onUploadingChange}
        disabled={disabled}
        selectable={selecting}
        selected={live}
        onSelectedChange={setSelected}
      />
    </Card>
  );
}

const HEX = /^#[0-9a-fA-F]{6}$/;

function EditColorModal({
  open, row, palette, usedColorIds, onClose, onPick, onCreated,
}: {
  open: boolean;
  row: DraftColor | null;
  palette: ColorOption[];
  usedColorIds: string[];
  onClose: () => void;
  onPick: (colorId: string) => void;
  onCreated: (color: ColorOption) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [hex, setHex] = useState("#1A1A1C");
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const create = useAction(
    async () =>
      api.post<{ color: { id: string; slug: string; name: string; hex: string } }>(
        "/api/v1/admin/colors",
        { name: name.trim(), hex }
      ),
    {
      onSuccess: ({ color }) => {
        const option: ColorOption = {
          id: color.id, slug: color.slug, name: color.name, hex: color.hex,
          hexSecondary: undefined, active: true, productCount: 0, variantCount: 0,
        };
        onCreated(option);
        setName("");
        toast({ tone: "success", title: "رنگ تازه ساخته شد" });
        onPick(option.id);
      },
    }
  );

  const used = new Set(usedColorIds);
  const choices = palette.filter((c) => c.active !== false || c.id === row?.colorId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="ویرایش رنگ"
      description="رنگ درست را انتخاب کنید. تصاویر، موجودی و قیمت هر سایز همراه رنگ منتقل می‌شوند."
    >
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {choices.map((color) => {
          const current = color.id === row?.colorId;
          const taken = used.has(color.id);
          return (
            <li key={color.id}>
              <button
                type="button"
                onClick={() => onPick(color.id)}
                disabled={current || taken}
                aria-pressed={current}
                className={cn(
                  "flex min-h-11 w-full items-center gap-2 rounded-md border px-2.5 text-start text-sm transition-colors",
                  current
                    ? "border-primary bg-primary-soft text-fg"
                    : "border-border bg-surface text-fg hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                <span aria-hidden className="size-4 shrink-0 rounded-full border border-border" style={{ background: color.hex }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{color.name}</span>
                  {(current || taken) && (
                    <span className="block text-[0.6875rem] text-fg-subtle">
                      {current ? "رنگ فعلی" : "در این محصول هست"}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {usedColorIds.length > 0 && (
        <p className="mt-3 text-xs leading-6 text-fg-muted">
          رنگی که در این محصول هست قابل انتخاب نیست تا تنوع تکراری ساخته نشود. برای یکی کردن،
          از «انتقال تصاویر» استفاده کنید و سپس رنگ اضافی را حذف کنید.
        </p>
      )}

      <form
        className="mt-4 space-y-3 border-t border-border pt-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) { setError("نام رنگ را وارد کنید."); nameRef.current?.focus(); return; }
          if (!HEX.test(hex)) { setError("کد رنگ باید به شکل #RRGGBB باشد."); return; }
          setError(null);
          void create.run();
        }}
      >
        <h3 className="text-sm font-bold text-fg">رنگ مورد نظر در فهرست نیست؟</h3>
        <div className="flex flex-wrap items-end gap-2">
          <Input
            ref={nameRef}
            label="نام رنگ تازه"
            className="min-w-40 flex-1"
            value={name}
            onChange={(e) => { setName(e.target.value); if (error) setError(null); }}
            error={error ?? create.error ?? undefined}
            placeholder="مثلاً: زرشکی"
            disabled={create.pending}
            autoComplete="off"
          />
          <label className="flex flex-col text-sm font-medium text-fg">
            <span className="mb-1.5">کد رنگ</span>
            <input
              type="color"
              value={HEX.test(hex) ? hex : "#000000"}
              onChange={(e) => setHex(e.target.value)}
              disabled={create.pending}
              className="h-12 w-16 cursor-pointer rounded-md border border-border-strong bg-surface p-1"
            />
          </label>
          <Button type="submit" variant="secondary" loading={create.pending} disabled={create.pending} icon={<Plus className="size-4" aria-hidden />}>
            ساخت و انتخاب
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RemoveColorModal({
  open, row, name, variantCount, others, onClose, onConfirm,
}: {
  open: boolean;
  row: DraftColor | null;
  name: string;
  variantCount: number;
  others: { key: string; name: string }[];
  onClose: () => void;
  onConfirm: (moveImagesTo?: string) => void;
}) {
  const [target, setTarget] = useState("");
  const [discard, setDiscard] = useState(false);
  const [seeded, setSeeded] = useState<string | null>(null);
  if (open && row && seeded !== row.key) {
    setSeeded(row.key);
    setTarget("");
    setDiscard(false);
  }
  if (!row) return null;
  const imageCount = row.images.length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`حذف رنگ «${name}»`}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>انصراف</Button>
          {imageCount > 0 && others.length > 0 && (
            <Button onClick={() => onConfirm(target)} disabled={!target} icon={<ArrowLeftRight className="size-4" aria-hidden />}>
              انتقال تصاویر و حذف رنگ
            </Button>
          )}
          <Button
            variant="danger"
            onClick={() => onConfirm()}
            disabled={imageCount > 0 && !discard}
            icon={<Trash2 className="size-4" aria-hidden />}
          >
            {imageCount > 0 ? "حذف رنگ و تصاویر" : "حذف رنگ"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-sm leading-7">
        {imageCount > 0 && (
          <Alert tone="warning">
            این رنگ هنوز {toPersianDigits(imageCount)} تصویر دارد. اگر تصاویر متعلق به رنگ دیگری
            هستند، پیش از حذف آن‌ها را منتقل کنید تا نیازی به آپلود دوباره نباشد.
          </Alert>
        )}
        {variantCount > 0 && (
          <p className="text-fg-muted">
            {toPersianDigits(variantCount)} تنوع (سایز و موجودی) این رنگ هم حذف می‌شود. اگر فقط رنگ را
            اشتباه انتخاب کرده‌اید، به‌جای حذف از «ویرایش رنگ» استفاده کنید تا موجودی حفظ شود.
          </p>
        )}

        {imageCount > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {row.images.map((url) => (
              <span key={url} className="relative size-14 shrink-0 overflow-hidden rounded-md border border-border bg-surface-inset">
                <Image src={url} unoptimized={isLocalUpload(url)} alt="" fill sizes="56px" className="object-cover" />
              </span>
            ))}
          </div>
        )}

        {imageCount > 0 && others.length > 0 && (
          <Select
            label="انتقال تصاویر به"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            options={others.map((o) => ({ value: o.key, label: o.name }))}
            placeholder="انتخاب رنگ مقصد"
          />
        )}

        {imageCount > 0 && (
          <Checkbox
            label="می‌خواهم تصاویر این رنگ هم حذف شوند (فایلی که جای دیگری استفاده نشده باشد، پس از ذخیره پاک می‌شود)"
            checked={discard}
            onChange={(e) => setDiscard(e.target.checked)}
          />
        )}
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Variant matrix                                                              */
/* -------------------------------------------------------------------------- */

function VariantMatrix({
  draft, options, usedSizes, variantMap, colorById, disabled, onSetStock, onRemove, onFill,
}: {
  draft: EditorDraft;
  options: ProductEditorOptions;
  usedSizes: number[];
  variantMap: Map<string, ProductDraft["variants"][number]>;
  colorById: Map<string, { id: string; name: string; hex: string }>;
  disabled: boolean;
  onSetStock: (colorId: string, size: number, stock: number) => void;
  onRemove: (colorId: string, size: number) => void;
  onFill: (sizes: number[], stock: number) => void;
}) {
  const [fillSizes, setFillSizes] = useState<number[]>([]);
  const [fillStock, setFillStock] = useState("0");

  // Columns are whatever sizes the product already uses, so an existing
  // product opens showing exactly its own grid.
  const columns = usedSizes.length ? usedSizes : [];

  if (draft.colors.length === 0) {
    return (
      <Card>
        <p className="py-6 text-center text-sm text-fg-muted">
          ابتدا در تب «رنگ‌ها و تصاویر» حداقل یک رنگ انتخاب کنید.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-1 flex items-center gap-2 font-bold text-fg">
          <Wand2 className="size-4 text-fg-subtle" aria-hidden />
          افزودن سایز به همه رنگ‌ها
        </h2>
        <p className="mb-3 text-xs text-fg-muted">
          سایزهای انتخاب‌شده برای همه رنگ‌های محصول ساخته می‌شوند. ترکیب‌های موجود دست‌نخورده
          می‌مانند.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {options.sizes.map((size) => {
            const active = fillSizes.includes(size.value);
            return (
              <button
                key={size.id}
                type="button"
                onClick={() =>
                  setFillSizes((current) =>
                    active ? current.filter((s) => s !== size.value) : [...current, size.value]
                  )
                }
                aria-pressed={active}
                disabled={disabled}
                className={cn(
                  "tnum grid h-10 min-w-10 place-items-center rounded-md border px-2 text-sm font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-fg"
                    : "border-border bg-surface text-fg-muted hover:text-fg"
                )}
              >
                {toPersianDigits(size.value)}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Input
            label="موجودی اولیه هر تنوع"
            dir="ltr"
            inputMode="numeric"
            className="w-40 [&_input]:text-start"
            value={fillStock}
            onChange={(e) => setFillStock(e.target.value.replace(/\D/g, ""))}
            disabled={disabled}
          />
          <Button
            variant="secondary"
            onClick={() => {
              onFill(fillSizes, Number(fillStock) || 0);
              setFillSizes([]);
            }}
            disabled={disabled || fillSizes.length === 0}
            icon={<Plus className="size-4" aria-hidden />}
          >
            ساخت تنوع‌ها
          </Button>
        </div>
      </Card>

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <h2 className="font-bold text-fg">موجودی به تفکیک رنگ و سایز</h2>
          <p className="tnum text-xs text-fg-muted">
            {toPersianDigits(draft.variants.length)} تنوع
          </p>
        </div>

        {columns.length === 0 ? (
          <p className="p-6 text-center text-sm text-fg-muted">
            هنوز تنوعی ساخته نشده است. از بخش بالا سایزها را اضافه کنید.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="sticky start-0 bg-surface p-3 text-start font-medium text-fg-muted">
                    رنگ
                  </th>
                  {columns.map((size) => (
                    <th key={size} scope="col" className="tnum p-3 text-center font-medium text-fg-muted">
                      {toPersianDigits(size)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {draft.colors.map((color) => {
                  const info = colorById.get(color.colorId);
                  return (
                    <tr key={color.key ?? color.colorId} className="border-b border-border">
                      <th scope="row" className="sticky start-0 bg-surface p-3 text-start font-normal">
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className="size-4 shrink-0 rounded-full border border-border"
                            style={{ background: info?.hex }}
                          />
                          <span className="whitespace-nowrap text-fg">{info?.name}</span>
                        </span>
                      </th>
                      {columns.map((size) => {
                        const variant = variantMap.get(`${color.colorId}:${size}`);
                        return (
                          <td key={size} className="p-2 text-center">
                            {variant ? (
                              <span className="inline-flex items-center gap-1">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={String(variant.stock)}
                                  onChange={(e) =>
                                    onSetStock(color.colorId, size, Number(e.target.value.replace(/\D/g, "")) || 0)
                                  }
                                  aria-label={`موجودی ${info?.name} سایز ${size}`}
                                  disabled={disabled}
                                  dir="ltr"
                                  className={cn(
                                    "tnum h-10 w-14 rounded-md border bg-surface text-center text-sm",
                                    "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25",
                                    variant.stock === 0
                                      ? "border-danger/40 text-danger"
                                      : variant.stock <= 2
                                        ? "border-warning/50 text-fg"
                                        : "border-border text-fg"
                                  )}
                                />
                                <button
                                  type="button"
                                  onClick={() => onRemove(color.colorId, size)}
                                  aria-label={`حذف تنوع ${info?.name} سایز ${size}`}
                                  disabled={disabled}
                                  className="grid size-6 place-items-center rounded text-fg-subtle hover:text-danger"
                                >
                                  <X className="size-3.5" aria-hidden />
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onSetStock(color.colorId, size, 0)}
                                aria-label={`ساخت تنوع ${info?.name} سایز ${size}`}
                                disabled={disabled}
                                className="grid h-10 w-14 place-items-center rounded-md border border-dashed border-border text-fg-subtle hover:border-primary hover:text-primary"
                              >
                                <Plus className="size-4" aria-hidden />
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="border-t border-border p-3 text-xs text-fg-subtle">
          هر ترکیب رنگ و سایز فقط یک بار می‌تواند وجود داشته باشد. تنوعی که در سفارش‌های ثبت‌شده
          استفاده شده، هنگام ذخیره حذف نمی‌شود بلکه غیرفعال می‌شود تا سابقه سفارش‌ها سالم بماند.
        </p>
      </Card>
    </div>
  );
}
