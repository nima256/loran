import { created, ok } from "@/server/lib/http";
import { adminRoute } from "@/server/lib/admin-route";
import { badRequest } from "@/server/lib/errors";
import { listMedia, uploadImage } from "@/server/services/media";

/**
 * GET / POST /api/v1/admin/media
 *
 * Upload validation lives in `services/media`: the file type is decided by
 * decoding the image, not by its name or declared type.
 */

export const GET = adminRoute(async () => ok({ media: await listMedia() }));

export const POST = adminRoute(async (request, { audit }) => {
  const form = await request.formData().catch(() => null);
  if (!form) throw badRequest("درخواست آپلود معتبر نیست.");

  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("فایلی برای آپلود انتخاب نشده است.");

  const folder = String(form.get("folder") ?? "products");
  const result = await uploadImage(file, folder);

  await audit({
    action: "media.upload",
    entityType: "media",
    entityId: result.key,
    summary: `تصویر ${result.key} آپلود شد`,
    meta: { bytes: result.bytes, width: result.width, height: result.height },
  });

  return created(result);
});
