"use client";

import { createContext, useContext, useMemo } from "react";
import { categoryNav, type CategoryNavItem } from "@/lib/navigation";
import type { Category } from "@/types";

/**
 * Categories, loaded once by the storefront layout on the server.
 *
 * The header and the mobile menu are client components that need the category
 * list. Without this they would `import { categories } from "@/data/catalog"`,
 * which pulled the entire product catalogue into every storefront bundle. The
 * server loads the eight rows it needs and hands them down as data instead.
 */

interface CatalogContextValue {
  categories: Category[];
  categoryLinks: CategoryNavItem[];
}

const CatalogContext = createContext<CatalogContextValue>({
  categories: [],
  categoryLinks: [],
});

export function useCatalog() {
  return useContext(CatalogContext);
}

export function CatalogProvider({
  categories,
  children,
}: {
  categories: Category[];
  children: React.ReactNode;
}) {
  const value = useMemo<CatalogContextValue>(
    () => ({ categories, categoryLinks: categoryNav(categories) }),
    [categories]
  );
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}
