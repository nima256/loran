/**
 * Category hierarchy helpers.
 *
 * Categories are stored flat with a `parentId`; every surface that needs the
 * tree (menus, the admin manager, filters, breadcrumbs) builds it here from
 * the same rows, so they can never disagree. Pure functions, safe on both the
 * server and the client.
 */

/** Top-level → sub → sub-sub. Deeper trees stop being navigable on a phone. */
export const MAX_CATEGORY_DEPTH = 3;

export interface TreeRow {
  id: string;
  parentId?: string | null;
}

export type CategoryNode<T extends TreeRow> = T & {
  children: CategoryNode<T>[];
  /** 0 for a top-level category. */
  depth: number;
};

/**
 * Builds the tree, keeping the input order among siblings (callers pass rows
 * already sorted by position).
 *
 * `dropOrphans`: a row whose parent is missing from `rows` — typically
 * because the parent is hidden on the storefront — is dropped together with
 * its subtree. Without it, such rows are promoted to the top level, which is
 * what the admin wants (nothing ever disappears from the manager).
 */
export function buildCategoryTree<T extends TreeRow>(
  rows: T[],
  { dropOrphans = false }: { dropOrphans?: boolean } = {}
): CategoryNode<T>[] {
  const ids = new Set(rows.map((r) => r.id));
  const childrenOf = new Map<string | null, T[]>();
  for (const row of rows) {
    const parent = row.parentId && ids.has(row.parentId) ? row.parentId : null;
    if (row.parentId && !ids.has(row.parentId) && dropOrphans) continue;
    const list = childrenOf.get(parent) ?? [];
    list.push(row);
    childrenOf.set(parent, list);
  }

  const seen = new Set<string>();
  const build = (parent: string | null, depth: number): CategoryNode<T>[] =>
    (childrenOf.get(parent) ?? [])
      // A corrupt cycle must never hang a render.
      .filter((row) => !seen.has(row.id) && seen.add(row.id))
      .map((row) => ({ ...row, depth, children: build(row.id, depth + 1) }));

  return build(null, 0);
}

/** Depth-first list of a tree — what an indented list or a <select> shows. */
export function flattenCategoryTree<T extends TreeRow>(nodes: CategoryNode<T>[]): CategoryNode<T>[] {
  return nodes.flatMap((node) => [node, ...flattenCategoryTree(node.children)]);
}

/** The category and every category below it. */
export function descendantIds(rows: TreeRow[], id: string): string[] {
  const out = [id];
  for (let i = 0; i < out.length; i++) {
    for (const row of rows) {
      if (row.parentId === out[i] && !out.includes(row.id)) out.push(row.id);
    }
  }
  return out;
}

/** Root-first chain of ancestors, not including the category itself. */
export function categoryAncestors<T extends TreeRow>(rows: T[], id: string): T[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const chain: T[] = [];
  let current = byId.get(id)?.parentId;
  while (current && byId.has(current) && chain.length < 20) {
    const row = byId.get(current)!;
    chain.unshift(row);
    current = row.parentId;
  }
  return chain;
}

/** How many levels the subtree under `id` adds (0 for a leaf). */
export function subtreeHeight(rows: TreeRow[], id: string): number {
  const children = rows.filter((r) => r.parentId === id);
  return children.length ? 1 + Math.max(...children.map((c) => subtreeHeight(rows, c.id))) : 0;
}
