import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/prisma";
import {
  getCategoryFamily, getCategorySubtreeCounts, listCategories, listBrands, searchProducts,
} from "@/server/services/catalog";
import { createProduct } from "@/server/services/admin-products";
import { createCategory, deleteCategory, reorderCategories, updateCategory } from "@/server/services/taxonomy";
import { buildCategoryTree, flattenCategoryTree } from "@/lib/category-tree";
import { categoryNav } from "@/lib/navigation";

/**
 * Hierarchical categories: parent/child storage, validation (cycles, depth),
 * descendant-aware product listing, safe deletion, sibling ordering, and the
 * storefront menu tree.
 */

const stamp = Date.now();
const createdCategories: string[] = [];
const createdProducts: string[] = [];

afterAll(async () => {
  await prisma.product.deleteMany({ where: { id: { in: createdProducts } } });
  // Children first: the parent link is ON DELETE RESTRICT.
  for (const id of [...createdCategories].reverse()) {
    await prisma.category.delete({ where: { id } }).catch(() => undefined);
  }
  await prisma.$disconnect();
});

async function category(name: string, parentId?: string | null) {
  const row = await createCategory({ name: `${name} ${stamp}`, parentId });
  createdCategories.push(row.id);
  return row;
}

async function productIn(categoryId: string) {
  const [brand] = await listBrands();
  const color = await prisma.color.findFirstOrThrow();
  const created = await createProduct({
    name: `محصول درخت ${stamp} ${createdProducts.length}`,
    slug: `t-tree-${stamp}-${createdProducts.length}`,
    brandId: brand.id,
    categoryIds: [categoryId],
    gender: "women",
    price: 1_000_000,
    compareAtPrice: null,
    description: "",
    features: [],
    specs: [],
    tags: [],
    active: true,
    colors: [{ colorId: color.id, images: ["/products/runner-tan-side.svg"] }],
    variants: [{ colorId: color.id, size: 40, stock: 3 }],
  });
  createdProducts.push(created.id);
  return created;
}

describe("category hierarchy", () => {
  it("stores parent → child → grandchild and lists products of the whole subtree", async () => {
    const parent = await category("والد");
    const child = await category("فرزند", parent.id);
    const grandchild = await category("نوه", child.id);
    expect(child.parentId).toBe(parent.id);
    expect(grandchild.parentId).toBe(child.id);

    const inChild = await productIn(child.id);
    const inGrandchild = await productIn(grandchild.id);

    // The parent page lists everything under it; the child page its own subtree.
    const parentIds = (await searchProducts({ categories: [parent.slug], page: 1 })).items.map((p) => p.id);
    expect(parentIds).toEqual(expect.arrayContaining([inChild.id, inGrandchild.id]));
    const grandIds = (await searchProducts({ categories: [grandchild.slug], page: 1 })).items.map((p) => p.id);
    expect(grandIds).toEqual([inGrandchild.id]);

    const counts = await getCategorySubtreeCounts();
    expect(counts.get(parent.id)).toBe(2);
    expect(counts.get(child.id)).toBe(2);
    expect(counts.get(grandchild.id)).toBe(1);

    // Breadcrumb ancestors and visible children.
    const family = await getCategoryFamily(grandchild.slug);
    expect(family?.ancestors.map((a) => a.id)).toEqual([parent.id, child.id]);
    expect((await getCategoryFamily(parent.slug))?.children.map((c) => c.id)).toEqual([child.id]);

    // The storefront menu nests them.
    const nav = categoryNav(await listCategories());
    const node = nav.find((n) => n.slug === parent.slug);
    expect(node?.children[0].slug).toBe(child.slug);
    expect(node?.children[0].children[0].slug).toBe(grandchild.slug);
  });

  it("refuses a 4th level, a cycle, and a missing parent", async () => {
    const a = await category("سطح۱");
    const b = await category("سطح۲", a.id);
    const c = await category("سطح۳", b.id);
    await expect(createCategory({ name: `سطح۴ ${stamp}`, parentId: c.id })).rejects.toThrow(/سطح/);
    await expect(updateCategory(a.id, { parentId: c.id })).rejects.toThrow(/زیرمجموعه خودش/);
    await expect(updateCategory(a.id, { parentId: a.id })).rejects.toThrow(/زیرمجموعه خودش/);
    await expect(createCategory({ name: `بی‌والد ${stamp}`, parentId: "missing-id" })).rejects.toThrow(/والد/);
  });

  it("moves a subcategory to another parent (and back to the top level)", async () => {
    const one = await category("والد یک");
    const two = await category("والد دو");
    const sub = await category("زیردسته متحرک", one.id);
    await category("زیردسته موجود", two.id);

    const moved = await updateCategory(sub.id, { parentId: two.id });
    expect(moved.parentId).toBe(two.id);
    // Appended after the existing sibling.
    expect(moved.position).toBe(1);
    expect((await getCategoryFamily(two.slug))?.children.map((c) => c.id)).toContain(sub.id);

    const top = await updateCategory(sub.id, { parentId: null });
    expect(top.parentId).toBeNull();
  });

  it("hides a subcategory whose parent is hidden", async () => {
    const parent = await category("والد پنهان");
    const child = await category("فرزند والد پنهان", parent.id);
    await updateCategory(parent.id, { active: false });
    expect(await getCategoryFamily(child.slug)).toBeNull();
    expect(categoryNav(await listCategories()).some((n) => n.slug === child.slug)).toBe(false);
  });

  it("refuses to delete a category that still has subcategories", async () => {
    const parent = await category("والد حذف");
    const child = await category("فرزند حذف", parent.id);
    await expect(deleteCategory(parent.id)).rejects.toThrow(/زیردسته/);
    expect(await prisma.category.findUnique({ where: { id: parent.id } })).not.toBeNull();
    // Once the child is gone, the parent can go.
    expect((await deleteCategory(child.id)).action).toBe("deleted");
    expect((await deleteCategory(parent.id)).action).toBe("deleted");
  });

  it("reorders siblings only, and refuses a list that mixes parents", async () => {
    const parent = await category("والد ترتیب");
    const x = await category("الف", parent.id);
    const y = await category("ب", parent.id);
    await reorderCategories([y.id, x.id]);
    const children = (await getCategoryFamily(parent.slug))!.children.map((c) => c.id);
    expect(children).toEqual([y.id, x.id]);
    await expect(reorderCategories([y.id, x.id, parent.id])).rejects.toThrow();
  });

  it("flattens the tree depth-first with depths", () => {
    const rows = [
      { id: "a", parentId: null }, { id: "b", parentId: "a" }, { id: "c", parentId: "b" }, { id: "d", parentId: null },
    ];
    expect(flattenCategoryTree(buildCategoryTree(rows)).map((n) => `${n.id}${n.depth}`)).toEqual(["a0", "b1", "c2", "d0"]);
    // An orphan is promoted for the admin, dropped for the storefront.
    const orphan = [{ id: "x", parentId: "gone" }];
    expect(buildCategoryTree(orphan)).toHaveLength(1);
    expect(buildCategoryTree(orphan, { dropOrphans: true })).toHaveLength(0);
  });
});
