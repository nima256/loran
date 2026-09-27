import { Suspense } from "react";
import { AlertTriangle, Boxes, PackageX, Wallet } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import {
  AdminFilterChips,
  AdminPagination,
  AdminResultCount,
  AdminSearch,
} from "@/components/admin/AdminTableControls";
import { ProductLink, StockCell, StockStatus } from "@/components/admin/InventoryEditor";
import { StatTile } from "@/components/admin/Charts";
import { Card, DataTable } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Feedback";
import { ButtonLink } from "@/components/ui/Button";
import { prisma } from "@/server/lib/prisma";
import { getInventorySummary } from "@/server/services/analytics";
import { paginated, paginationArgs, paginationSchema } from "@/server/lib/validation";
import { normalizePersian } from "@/lib/persian";
import { formatCompactPrice, toPersianDigits } from "@/lib/format";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

/**
 * Admin → Inventory.
 *
 * Variant-level stock, paginated on the server. Editing a cell writes straight
 * to the variant, so the warehouse number and what the storefront will sell are
 * always the same number.
 */

export const dynamic = "force-dynamic";

const filterSchema = paginationSchema.extend({
  q: z.string().max(120).optional(),
  stock: z.enum(["all", "low", "out"]).default("all"),
  sort: z.enum(["stock-asc", "stock-desc", "name"]).default("stock-asc"),
});

interface Row {
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  sku: string;
  colorName: string;
  colorHex: string;
  size: number;
  stock: number;
  price: number;
}

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") flat[key] = value;
  }
  const filters = filterSchema.parse({ ...flat, pageSize: flat.pageSize ?? "40" });

  const where: Prisma.ProductVariantWhereInput = { product: { active: true }, active: true };
  if (filters.stock === "out") where.stock = 0;
  if (filters.stock === "low") where.stock = { gt: 0, lte: 3 };
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { sku: { contains: q, mode: "insensitive" } },
      { product: { searchText: { contains: normalizePersian(q) } } },
    ];
  }

  const orderBy: Prisma.ProductVariantOrderByWithRelationInput =
    filters.sort === "stock-desc"
      ? { stock: "desc" }
      : filters.sort === "name"
        ? { product: { name: "asc" } }
        : { stock: "asc" };

  const [total, rows, summary] = await Promise.all([
    prisma.productVariant.count({ where }),
    prisma.productVariant.findMany({
      where,
      orderBy,
      include: {
        product: { select: { id: true, name: true, slug: true, price: true } },
        color: { select: { name: true, hex: true } },
        size: { select: { value: true } },
      },
      ...paginationArgs(filters),
    }),
    getInventorySummary(),
  ]);

  const result = paginated<Row>(
    rows.map((row) => ({
      variantId: row.id,
      productId: row.product.id,
      productName: row.product.name,
      productSlug: row.product.slug,
      sku: row.sku,
      colorName: row.color.name,
      colorHex: row.color.hex,
      size: row.size.value,
      stock: row.stock,
      price: row.price ?? row.product.price,
    })),
    total,
    filters
  );

  return (
    <>
      <AdminPageHeader
        title="موجودی انبار"
        description="موجودی به تفکیک رنگ و سایز. تغییر هر عدد بلافاصله در فروشگاه اعمال می‌شود."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="کل تنوع‌ها"
          value={toPersianDigits(summary.totalVariants)}
          icon={<Boxes className="size-4" aria-hidden />}
        />
        <StatTile
          label="ناموجود"
          value={toPersianDigits(summary.outOfStockCount)}
          icon={<PackageX className="size-4" aria-hidden />}
        />
        <StatTile
          label="رو به اتمام"
          value={toPersianDigits(summary.lowStockCount)}
          hint="۳ عدد یا کمتر"
          icon={<AlertTriangle className="size-4" aria-hidden />}
        />
        <StatTile
          label="ارزش انبار"
          value={formatCompactPrice(summary.inventoryValue)}
          hint={`${toPersianDigits(summary.totalUnits)} عدد کالا`}
          icon={<Wallet className="size-4" aria-hidden />}
        />
      </div>

      <Card className="mb-4 space-y-3">
        <Suspense fallback={<div className="skeleton h-11 rounded-md" />}>
          <AdminSearch placeholder="نام محصول یا کد کالا (SKU)" />
        </Suspense>
        <Suspense fallback={null}>
          <AdminFilterChips
            param="stock"
            options={[
              { value: "", label: "همه" },
              { value: "low", label: "رو به اتمام", count: summary.lowStockCount },
              { value: "out", label: "ناموجود", count: summary.outOfStockCount },
            ]}
          />
        </Suspense>
        <Suspense fallback={null}>
          <AdminFilterChips
            param="sort"
            options={[
              { value: "", label: "کم‌موجودی اول" },
              { value: "stock-desc", label: "پرموجودی اول" },
              { value: "name", label: "نام محصول" },
            ]}
          />
        </Suspense>
      </Card>

      <div className="mb-3">
        <AdminResultCount
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          noun="تنوع"
        />
      </div>

      <DataTable<Row>
        rows={result.items}
        getKey={(row) => row.variantId}
        empty={
          <EmptyState
            title="تنوعی با این فیلترها نیست"
            description="عبارت جست‌وجو یا فیلتر را تغییر دهید."
            action={<ButtonLink href="/admin/inventory" variant="secondary">نمایش همه</ButtonLink>}
          />
        }
        renderCard={(row) => (
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <ProductLink slug={row.productSlug} name={row.productName} />
                <p className="tnum mt-1 flex flex-wrap items-center gap-x-2 text-xs text-fg-subtle">
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="size-3 rounded-full border border-border" style={{ background: row.colorHex }} />
                    {row.colorName}
                  </span>
                  <span>سایز {toPersianDigits(row.size)}</span>
                </p>
                <p className="tnum mt-0.5 text-xs text-fg-subtle" dir="ltr">{row.sku}</p>
              </div>
              <StockCell variantId={row.variantId} productId={row.productId} stock={row.stock} />
            </div>
          </Card>
        )}
        columns={[
          {
            key: "product",
            header: "محصول",
            cell: (row) => <ProductLink slug={row.productSlug} name={row.productName} />,
          },
          {
            key: "color",
            header: "رنگ",
            cell: (row) => (
              <span className="inline-flex items-center gap-2 text-fg-muted">
                <span aria-hidden className="size-4 rounded-full border border-border" style={{ background: row.colorHex }} />
                {row.colorName}
              </span>
            ),
          },
          {
            key: "size",
            header: "سایز",
            align: "center",
            cell: (row) => <span className="tnum text-fg-muted">{toPersianDigits(row.size)}</span>,
          },
          {
            key: "sku",
            header: "کد کالا",
            hideOn: "md",
            cell: (row) => <span className="tnum text-xs text-fg-subtle" dir="ltr">{row.sku}</span>,
          },
          {
            key: "status",
            header: "وضعیت",
            cell: (row) => <StockStatus stock={row.stock} />,
          },
          {
            key: "stock",
            header: "موجودی",
            align: "end",
            cell: (row) => (
              <StockCell variantId={row.variantId} productId={row.productId} stock={row.stock} />
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
