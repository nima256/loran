import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { env } from "@/server/lib/env";

/**
 * Serve locally stored media from UPLOAD_DIR, including files created while
 * Next is running. The /uploads/* rewrite preserves existing database URLs.
 * The path is deliberately limited to the exact output format of uploadImage:
 * one safe folder and one server-generated WebP filename.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ folder: string; filename: string }> }
) {
  const { folder, filename } = await params;
  if (!/^[a-z0-9-]+$/i.test(folder) || !/^[a-z0-9_-]+\.webp$/i.test(filename)) {
    return new Response("Not found", { status: 404 });
  }

  const filePath = path.resolve(process.cwd(), env.UPLOAD_DIR, folder, filename);
  try {
    const file = await stat(filePath);
    if (!file.isFile()) return new Response("Not found", { status: 404 });
    const headers = {
      "Content-Type": "image/webp",
      "Content-Length": String(file.size),
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    };
    if (request.method === "HEAD") return new Response(null, { headers });
    const data = await readFile(filePath);
    return new Response(new Uint8Array(data), { headers });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    throw error;
  }
}

export const HEAD = GET;
