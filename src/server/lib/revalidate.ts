import "server-only";
import { revalidatePath } from "next/cache";

/**
 * Drops every cached storefront render after an admin write.
 *
 * The catalogue pages that read the database are rendered per request, but the
 * storefront layout (header category menu) is shared by the static content
 * pages too, and those are cached. Purging the whole layout is cheap — the
 * next visitor re-renders — and means an administrator never has to wonder
 * why a change "didn't show up".
 *
 * Outside a Next request (scripts, tests) there is no cache to purge, which is
 * not an error.
 */
export function revalidateStorefront(): void {
  try {
    revalidatePath("/", "layout");
  } catch {
    // No request scope — nothing is cached, so there is nothing to purge.
  }
}
