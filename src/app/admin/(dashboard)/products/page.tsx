import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import {
  AdminFilterChips,
  AdminPagination,
  AdminResultCount,
  AdminSearch,
} from "@/components/admin/AdminTableControls";
import { Card, DataTable } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { PriceInline } from "@/components/ui/Price";
import {
  listAdminProducts,
  type AdminProductListItem,
} from "@/server/services/admin-products";
import { listCategories } from "@/server/services/catalog";
import { productFilterSchema } from "@/server/schemas/admin";
import { GENDER_LABELS } from "@/lib/shop-params";
import { toPersianDigits } from "@/lib/format";
import type { Gender } from "@/types";

/** Admin products — server-side paginated, searchable and filterable. */

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") flat[key] = value;
  }

  const filters = productFilterSchema.parse(flat);
  const [result, categories] = await Promise.all([
    listAdminProducts(filters),
    listCategories({ includeInactive: true }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="محصولات"
        description={`${toPersianDigits(result.total)} محصول`}
        actions={
          <ButtonLink href="/admin/products/new" icon={<Plus className="size-4" aria-hidden />}>
            افزودن محصول
          </ButtonLink>
        }
      />

      <Card className="mb-4 space-y-3">
        <Suspense fallback={<div className="skeleton h-11 rounded-md" />}>
          <AdminSearch placeholder="نام محصول، نشانی یا کد کالا (SKU)" />
        </Suspense>
        <Suspense fallback={null}>
          <AdminFilterChips
            param="status"
            options={[
              { value: "", label: "همه" },
              { value: "active", label: "فعال" },
              { value: "inactive", label: "غیرفعال / بایگانی" },
            ]}
          />
        </Suspense>
        <Suspense fallback={null}>
          <AdminFilterChips
            param="stock"
            options={[
              { value: "", label: "هر موجودی" },
              { value: "in", label: "موجود" },
              { value: "low", label: "رو به اتمام" },
              { value: "out", label: "ناموجود" },
            ]}
          />
        </Suspense>
        <Suspense fallback={null}>
          <AdminFilterChips
            param="categoryId"
            options={[
              { value: "", label: "همه دسته‌ها" },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </Suspense>
      </Card>

      <div className="mb-3">
        <AdminResultCount
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          noun="محصول"
        />
      </div>

      <DataTable<AdminProductListItem>
        rows={result.items}
        getKey={(product) => product.id}
        empty={
          <EmptyState
            title="محصولی با این فیلترها نیست"
            description="فیلتر یا عبارت جست‌وجو را تغییر دهید."
            action={<ButtonLink href="/admin/products" variant="secondary">نمایش همه محصولات</ButtonLink>}
          />
        }
        renderCard={(product) => (
          <Card>
            <div className="flex gap-3">
              <span className="relative size-16 shrink-0 overflow-hidden rounded-md bg-surface-inset">
                {product.image && <Image src={product.image} alt="" fill sizes="64px" className="object-cover" />}
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/admin/products/${product.slug}`} className="line-clamp-2 text-sm font-medium text-fg hover:text-primary dark:hover:text-[color:var(--primary-soft-fg)]">
                  {product.name}
                </Link>
                <p className="mt-1 text-xs text-fg-muted">{product.brandName}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <PriceInline value={product.price} className="text-sm" />
                  <StockBadge stock={product.totalStock} />
                  {!product.active && <Badge tone="neutral" size="sm">غیرفعال</Badge>}
                </div>
              </div>
            </div>
          </Card>
        )}
        columns={[
          {
            key: "product",
            header: "محصول",
            cell: (product) => (
              <div className="flex items-center gap-3">
                <span className="relative size-11 shrink-0 overflow-hidden rounded-md bg-surface-inset">
                  {product.image && <Image src={product.image} alt="" fill sizes="44px" className="object-cover" />}
                </span>
                <div className="min-w-0">
                  <Link href={`/admin/products/${product.slug}`} className="line-clamp-1 font-medium text-fg hover:text-primary dark:hover:text-[color:var(--primary-soft-fg)]">
                    {product.name}
                  </Link>
                  <p className="text-xs text-fg-subtle" dir="ltr">{product.slug}</p>
                </div>
              </div>
            ),
          },
          {
            key: "category",
            header: "دسته‌بندی",
            hideOn: "md",
            cell: (product) => (
              <span className="text-fg-muted">{product.categoryNames.join("، ") || "—"}</span>
            ),
          },
          {
            key: "gender",
            header: "جنسیت",
            hideOn: "md",
            cell: (product) => (
              <span className="text-fg-muted">{GENDER_LABELS[product.gender as Gender]}</span>
            ),
          },
          {
            key: "price",
            header: "قیمت",
            align: "end",
            cell: (product) => <PriceInline value={product.price} className="text-sm" />,
          },
          {
            key: "variants",
            header: "تنوع",
            align: "center",
            cell: (product) => (
              <span className="tnum text-fg-muted">{toPersianDigits(product.variantCount)}</span>
            ),
          },
          {
            key: "stock",
            header: "موجودی",
            align: "center",
            cell: (product) => <StockBadge stock={product.totalStock} />,
          },
          {
            key: "status",
            header: "وضعیت",
            cell: (product) =>
              product.active ? (
                <Badge tone="success" size="sm">فعال</Badge>
              ) : (
                <Badge tone="neutral" size="sm">غیرفعال</Badge>
              ),
          },
          {
            key: "actions",
            header: "عملیات",
            align: "end",
            cell: (product) => (
              <Link
                href={`/admin/products/${product.slug}`}
                className="inline-flex h-9 items-center rounded-md border border-border px-2.5 text-xs text-fg-muted hover:text-fg"
              >
                ویرایش
              </Link>
            ),
          },
        ]}
      />

      <Suspense fallback={null}>
        <AdminPagination page={result.page} totalPages={result.totalPages} className="mt-6" />
      </Suspense>
    </>
  );
}

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) return <Badge tone="danger" size="sm">ناموجود</Badge>;
  if (stock <= 5) {
    return (
      <Badge tone="warning" size="sm" className="tnum">
        {toPersianDigits(stock)} عدد
      </Badge>
    );
  }
  return (
    <span className="tnum text-sm text-fg-muted">{toPersianDigits(stock)}</span>
  );
}
