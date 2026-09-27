import "server-only";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../lib/prisma";
import { env } from "../lib/env";
import { badRequest } from "../lib/errors";
import { logger } from "../lib/logger";
import { randomToken } from "../lib/crypto";

/**
 * Product and category image uploads.
 *
 * The rules this module exists to enforce:
 *
 *  - The file type is decided by **decoding the image**, not by its extension
 *    or its declared Content-Type. A `.jpg` that is really a script fails to
 *    decode and is rejected. This is the check that matters: an extension is
 *    just a string the uploader chose.
 *  - Output is always re-encoded by sharp. Nothing the client sent is written
 *    to disk verbatim, so no embedded payload survives.
 *  - EXIF and every other metadata block is dropped — uploaded product photos
 *    routinely carry GPS coordinates from the shop floor.
 *  - Filenames are random. The uploader never influences the path, so a
 *    traversal or an overwrite of an existing asset is not expressible.
 *  - Size is capped before decoding, and pixel dimensions after, so a "zip
 *    bomb" style image cannot exhaust memory.
 */

/** Formats accepted for upload, by what they actually decode as. */
const ALLOWED_FORMATS = new Set(["jpeg", "jpg", "png", "webp", "avif", "gif"]);

/** Longest edge of the stored image. Product photography needs no more. */
const MAX_DIMENSION = 2000;
/** Guards against decompression bombs: 50 megapixels is far beyond any photo. */
const MAX_PIXELS = 50_000_000;

export interface UploadResult {
  url: string;
  key: string;
  width: number;
  height: number;
  bytes: number;
  mimeType: string;
}

export async function uploadImage(file: File, folder = "products"): Promise<UploadResult> {
  if (file.size === 0) throw badRequest("فایل انتخاب‌شده خالی است.");
  if (file.size > env.UPLOAD_MAX_BYTES) {
    const mb = Math.round(env.UPLOAD_MAX_BYTES / (1024 * 1024));
    throw badRequest(`حجم تصویر نباید بیشتر از ${mb} مگابایت باشد.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Decoding is the real content check — the declared type is not consulted.
  let image = sharp(buffer, { failOn: "error" });
  let metadata;
  try {
    metadata = await image.metadata();
  } catch {
    throw badRequest("فایل انتخاب‌شده یک تصویر معتبر نیست.");
  }

  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
    throw badRequest("فقط تصویرهای JPEG، PNG، WebP یا AVIF پذیرفته می‌شوند.");
  }
  if (!metadata.width || !metadata.height) {
    throw badRequest("ابعاد تصویر قابل خواندن نیست.");
  }
  if (metadata.width * metadata.height > MAX_PIXELS) {
    throw badRequest("ابعاد تصویر بیش از حد بزرگ است.");
  }

  // Re-encode to WebP: good compression, universal support today, and the
  // re-encode is what guarantees nothing from the original file survives.
  image = image
    .rotate() // Applies the EXIF orientation before the metadata is dropped.
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    });

  const output = await image.webp({ quality: 82, effort: 4 }).toBuffer({ resolveWithObject: true });

  const safeFolder = folder.replace(/[^a-z0-9-]/gi, "") || "products";
  // The name is entirely server-generated; the uploader has no say in the path.
  const filename = `${Date.now().toString(36)}-${randomToken(8)}.webp`;
  const key = `${safeFolder}/${filename}`;

  const directory = path.join(process.cwd(), env.UPLOAD_DIR, safeFolder);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), output.data);

  const url = `${env.UPLOAD_PUBLIC_PREFIX}/${key}`;

  await prisma.mediaAsset.create({
    data: {
      url,
      key,
      mimeType: "image/webp",
      width: output.info.width,
      height: output.info.height,
      bytes: output.info.size,
    },
  });

  logger.info("تصویر آپلود شد", { key, bytes: output.info.size });

  return {
    url,
    key,
    width: output.info.width,
    height: output.info.height,
    bytes: output.info.size,
    mimeType: "image/webp",
  };
}

/**
 * Deletes an uploaded asset.
 *
 * A missing file on disk is not an error — the database row is what the
 * storefront reads, and leaving it behind pointing at nothing would be worse.
 */
export async function deleteImage(url: string): Promise<void> {
  const asset = await prisma.mediaAsset.findUnique({ where: { url } });
  if (!asset) return;

  try {
    await unlink(path.join(process.cwd(), env.UPLOAD_DIR, asset.key));
  } catch (error) {
    logger.warn("حذف فایل تصویر از دیسک انجام نشد", { key: asset.key, cause: error });
  }
  await prisma.mediaAsset.delete({ where: { url } });
}

export async function listMedia(limit = 60) {
  const rows = await prisma.mediaAsset.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((row) => ({
    url: row.url,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    bytes: row.bytes,
    createdAt: row.createdAt.toISOString(),
  }));
}
