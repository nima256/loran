import { created, ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { createCollection, listCollectionsForAdmin } from "@/server/services/taxonomy";
import { collectionSchema } from "@/server/schemas/admin";
import { revalidateStorefront } from "@/server/lib/revalidate";

/** GET / POST /api/v1/admin/collections */

export const GET = adminRoute(async () => ok({ collections: await listCollectionsForAdmin() }));

export const POST = adminRoute(async (request, { audit }) => {
  const input = await adminBody(request, collectionSchema);
  const collection = await createCollection(input);

  await audit({
    action: "collection.create",
    entityType: "collection",
    entityId: collection.id,
    summary: `کالکشن «${collection.name}» ایجاد شد`,
  });
  revalidateStorefront();

  return created({ collection });
});
