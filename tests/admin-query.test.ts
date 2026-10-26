import { describe, expect, it } from "vitest";
import { isLocalUpload } from "@/lib/media";
import { buildAdminQueryHref, updateAdminQuery } from "@/lib/admin-query";

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

// All admin list screens use these links (orders, products, inventory,
// customers, reviews, returns and requests). Repeated navigation must never
// depend on a React transition that could stay pending.
describe("native admin navigation URLs", () => {
  it("sets a filter, changes it repeatedly, and restores All", () => {
    const path = "/admin/orders";
    let href = buildAdminQueryHref(path, "page=4", "status", "awaiting_payment");
    expect(href).toBe(`${path}?status=awaiting_payment`);
    for (let i = 0; i < 20; i++) {
      const query = href.split("?")[1] ?? "";
      href = buildAdminQueryHref(path, query, "status", i % 2 ? "preparing" : "shipped");
      expect(new URL(href, "http://localhost").searchParams.get("status")).toBe(i % 2 ? "preparing" : "shipped");
    }
    href = buildAdminQueryHref(path, href.split("?")[1] ?? "", "status", null);
    expect(href).toBe(path);
  });

  it("combines product category, stock and status without losing existing query values", () => {
    const path = "/admin/products";
    let href = buildAdminQueryHref(path, "q=test&page=5", "categoryId", "cat-shoes");
    href = buildAdminQueryHref(path, href.split("?")[1] ?? "", "stock", "low");
    href = buildAdminQueryHref(path, href.split("?")[1] ?? "", "status", "active");
    let actual = new URL(href, "http://localhost");
    expect(actual.searchParams.get("q")).toBe("test");
    expect(actual.searchParams.get("categoryId")).toBe("cat-shoes");
    expect(actual.searchParams.get("stock")).toBe("low");
    expect(actual.searchParams.get("status")).toBe("active");
    expect(actual.searchParams.has("page")).toBe(false);
    href = buildAdminQueryHref(path, actual.search.slice(1), "categoryId", null);
    actual = new URL(href, "http://localhost");
    expect(actual.searchParams.has("categoryId")).toBe(false);
    expect(actual.searchParams.get("stock")).toBe("low");
  });
});
