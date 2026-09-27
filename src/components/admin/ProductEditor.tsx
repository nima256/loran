"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Plus, Save, Trash2, Wand2, X } from "lucide-react";
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
 */

export interface ProductDraft {
  id?: string;
  name: string;
  slug: string;
  subtitle: string;
  brandId: string;
  categoryIds: string[];
  gender: "men" | "women" | "unisex" | "kids";
  price: number;
  compareAtPrice: number | null;
  description: string;
  features: string[];
  specs: { label: string; value: string }[];
  tags: string[];
  active: boolean;
  colors: { colorId: string; images: string[] }[];
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

const GENDERS = [
  { value: "men", label: "مردانه" },
  { value: "women", label: "زنانه" },
  { value: "unisex", label: "یونیسکس" },
  { value: "kids", label: "بچگانه" },
];

const TAGS = [
  { value: "new", label: "جدید" },
  { value: "bestseller", label: "پرفروش" },
  { value: "sale", label: "حراج" },
  { value: "limited", label: "محدود" },
];

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
  const [draft, setDraft] = useState<ProductDraft>(initial);
  const [dirty, setDirty] = useState(mode === "create");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slugTouched, setSlugTouched] = useState(mode === "edit");

  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
    setErrors((e) => ({ ...e, [key as string]: "" }));
  };

  const colorById = useMemo(
    () => new Map(options.colors.map((c) => [c.id, c])),
    [options.colors]
  );

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
        colors: draft.colors,
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
    const next: Record<string, string> = {};
    if (draft.name.trim().length < 2) next.name = "نام محصول را وارد کنید.";
    if (!draft.slug.trim()) next.slug = "نشانی (slug) را وارد کنید.";
    if (!draft.brandId) next.brandId = "کالکشن را انتخاب کنید.";
    if (!draft.categoryIds.length) next.categoryIds = "حداقل یک دسته‌بندی انتخاب کنید.";
    if (!draft.price || draft.price <= 0) next.price = "قیمت را وارد کنید.";
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

  const toggleColor = (colorId: string) => {
    setDirty(true);
    setErrors((e) => ({ ...e, colors: "" }));
    setDraft((d) => {
      const exists = d.colors.some((c) => c.colorId === colorId);
      if (exists) {
        return {
          ...d,
          colors: d.colors.filter((c) => c.colorId !== colorId),
          // Variants of a removed colour go with it; keeping them would leave
          // stock attached to a colourway the product no longer has.
          variants: d.variants.filter((v) => v.colorId !== colorId),
        };
      }
      return { ...d, colors: [...d.colors, { colorId, images: [] }] };
    });
  };

  const setColorImages = (colorId: string, images: string[]) => {
    setDirty(true);
    setDraft((d) => ({
      ...d,
      colors: d.colors.map((c) => (c.colorId === colorId ? { ...c, images } : c)),
    }));
  };

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
            <Button
              onClick={submit}
              loading={save.pending}
              disabled={save.pending || (!dirty && mode === "edit")}
              icon={<Save className="size-4" aria-hidden />}
            >
              {mode === "create" ? "ایجاد محصول" : "ذخیره تغییرات"}
            </Button>
          </>
        }
      />

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
                value={draft.gender}
                onChange={(e) => set("gender", e.target.value as ProductDraft["gender"])}
                options={GENDERS}
                disabled={save.pending}
              />
            </Card>

            <Card>
              <h2 className="mb-3 font-bold text-fg">
                دسته‌بندی <span className="text-primary" aria-hidden>*</span>
              </h2>
              <div className="-my-1">
                {options.categories.map((category) => (
                  <Checkbox
                    key={category.id}
                    label={category.name}
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
              رنگ‌ها از فهرست مشترک فروشگاه انتخاب می‌شوند. برای افزودن رنگ تازه به{" "}
              <Link href="/admin/categories" className="text-primary hover:underline">
                مدیریت رنگ‌ها
              </Link>{" "}
              بروید.
            </p>
            <div className="flex flex-wrap gap-2">
              {options.colors.map((color) => {
                const active = draft.colors.some((c) => c.colorId === color.id);
                return (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => toggleColor(color.id)}
                    aria-pressed={active}
                    disabled={save.pending}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm transition-colors",
                      active
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
                    {active && <X className="size-3.5 opacity-60" aria-hidden />}
                  </button>
                );
              })}
            </div>
            {errors.colors && (
              <p role="alert" className="mt-2 text-sm text-danger">{errors.colors}</p>
            )}
          </Card>

          {draft.colors.map((color) => {
            const info = colorById.get(color.colorId);
            return (
              <Card key={color.colorId}>
                <h3 className="mb-3 flex items-center gap-2 font-bold text-fg">
                  <span
                    aria-hidden
                    className="size-4 rounded-full border border-border"
                    style={{ background: info?.hex }}
                  />
                  گالری رنگ {info?.name ?? color.colorId}
                  <Badge tone="neutral" size="sm" className="tnum">
                    {toPersianDigits(color.images.length)} تصویر
                  </Badge>
                </h3>
                <ImageUploader
                  images={color.images}
                  onChange={(images) => setColorImages(color.colorId, images)}
                  disabled={save.pending}
                />
              </Card>
            );
          })}

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
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Variant matrix                                                              */
/* -------------------------------------------------------------------------- */

function VariantMatrix({
  draft, options, usedSizes, variantMap, colorById, disabled, onSetStock, onRemove, onFill,
}: {
  draft: ProductDraft;
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
                    <tr key={color.colorId} className="border-b border-border">
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
