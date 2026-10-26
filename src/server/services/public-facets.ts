import "server-only";
import { getFacets } from "@/server/services/catalog";

/** Do not offer retired gender values even when historical products still use them. */
export async function getPublicFacets() {
  const facets = await getFacets();
  return { ...facets, genders: facets.genders.filter(({gender}) => gender === "men" || gender === "women") };
}
