import { describe, expect, it, vi } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

vi.mock("@/server/lib/env", () => ({ env: { UPLOAD_DIR: "./public/uploads" } }));

import { GET, HEAD } from "@/app/api/media/[folder]/[filename]/route";

const route = (folder: string, filename: string) => ({ params: Promise.resolve({ folder, filename }) });

describe("locally served runtime uploads", () => {
  it("answers GET and HEAD for a file that is created after module import", async () => {
    // The module is imported before the file is written: static public manifests
    // would miss this case, but the disk route must work at request time.
    const dir = path.resolve(process.cwd(), "public/uploads/products");
    await mkdir(dir, { recursive: true });
    const name = `runtime-media-test-${Date.now()}.webp`;
    const file = path.join(dir, name);
    try {
      await writeFile(file, Buffer.from([0x52, 0x49, 0x46, 0x46]));
      const request = new Request(`http://localhost:3000/uploads/products/${name}`);
      const response = await GET(request, route("products", name));
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("image/webp");
      expect((await response.arrayBuffer()).byteLength).toBe(4);
      const head = await HEAD(new Request(request.url, { method: "HEAD" }), route("products", name));
      expect(head.status).toBe(200);
      expect(head.headers.get("Content-Length")).toBe("4");
      expect((await head.arrayBuffer()).byteLength).toBe(0);
    } finally {
      await rm(file, { force: true });
    }
  });

  it("returns 404 for nonexistent files or unsafe paths", async () => {
    const request = new Request("http://localhost:3000/uploads/products/missing.webp");
    expect((await GET(request, route("products", "missing.webp"))).status).toBe(404);
    expect((await GET(request, route("..", "secret.webp"))).status).toBe(404);
    expect((await GET(request, route("products", "secret.txt"))).status).toBe(404);
  });
});
