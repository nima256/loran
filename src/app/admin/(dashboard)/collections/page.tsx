import { AdminPageHeader } from "@/components/admin/AdminShell";
import { CollectionManager } from "@/components/admin/CollectionManager";
import { listCollectionsForAdmin } from "@/server/services/taxonomy";

/**
 * Admin → Collections.
 *
 * Collections are the «کالکشن» every product already belongs to (the product
 * editor's collection field). This screen manages their storefront cards and
 * which products sit in each.
 */

export const dynamic = "force-dynamic";

export default async function AdminCollectionsPage() {
  const collections = await listCollectionsForAdmin();
  return (
    <>
      <AdminPageHeader
        title="کالکشن‌ها"
        description="کارت‌های بخش کالکشن صفحه اصلی و محصولات هر کالکشن."
      />
      <CollectionManager collections={collections} />
    </>
  );
}
