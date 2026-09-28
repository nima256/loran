import { describe, expect, it } from "vitest";
import { isLocalUpload } from "@/lib/media";
import { updateAdminQuery } from "@/lib/admin-query";

describe("runtime product media URLs", () => {
  it("uses the local file route only for uploaded files", () => {
    expect(isLocalUpload("/uploads/products/test.webp")).toBe(true);
    expect(isLocalUpload("/products/catalog.webp")).toBe(false);
    expect(isLocalUpload("https://example.com/image.webp")).toBe(false);
  });
});

describe("composable admin filters", () => {
  it("preserves other filters while resetting page on a new selection", () => {
    const first = updateAdminQuery("status=active&page=3", "stock", "low");
    expect(new URLSearchParams(first).get("status")).toBe("active");
    expect(new URLSearchParams(first).get("stock")).toBe("low");
    expect(new URLSearchParams(first).has("page")).toBe(false);
    expect(updateAdminQuery(first, "status", "inactive")).toContain("stock=low");
  });

  it("removes only the requested filter when All is chosen", () => {
    expect(updateAdminQuery("q=shoe&status=active&page=2", "status", null)).toBe("q=shoe");
  });
});
