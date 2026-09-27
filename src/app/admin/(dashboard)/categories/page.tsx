import { AdminPageHeader } from "@/components/admin/AdminShell";
import {
  CategoryManager,
  ColorManager,
  SizeManager,
} from "@/components/admin/TaxonomyManager";
import { getCategoryCounts, listCategories } from "@/server/services/catalog";
import { listColors, listSizes } from "@/server/services/taxonomy";

/**
 * Admin → Categories, colours and sizes.
 *
 * The three shared vocabularies of the catalogue live on one screen because
 * they are always edited together when setting up a product.
 */

export const dynamic = "force-dynamic";

export default async function AdminTaxonomyPage() {
  const [categories, counts, colors, sizes] = await Promise.all([
    listCategories({ includeInactive: true }),
    getCategoryCounts(),
    listColors({ includeInactive: true }),
    listSizes({ includeInactive: true }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="دسته‌بندی‌ها، رنگ‌ها و سایزها"
        description="واژگان مشترک کاتالوگ که هنگام ساخت محصول استفاده می‌شوند."
      />

      <div className="space-y-4">
        <CategoryManager
          categories={categories.map((c) => ({
            id: c.id,
            slug: c.slug,
            name: c.name,
            description: c.description,
            featured: c.featured,
            productCount: counts.get(c.id) ?? 0,
          }))}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <ColorManager colors={colors} />
          <SizeManager sizes={sizes} />
        </div>
      </div>
    </>
  );
}
