import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BottomNav } from "@/components/layout/BottomNav";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import { CatalogProvider } from "@/store/CatalogProvider";
import { listCategories } from "@/server/services/catalog";

/**
 * Public storefront chrome. The admin area deliberately does not use it.
 *
 * Categories are loaded here, on the server, and passed to the client chrome as
 * data — see `CatalogProvider` for why that indirection exists.
 */
export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const categories = await listCategories();

  return (
    <CatalogProvider categories={categories}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-[100]
                   focus:rounded-md focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-fg"
      >
        رفتن به محتوای اصلی
      </a>
      <Header />
      {/* Bottom padding clears the mobile bottom navigation. */}
      <main id="main" className="min-h-[60vh] mb-bottom-nav lg:mb-0">
        {children}
      </main>
      <Footer />
      <BottomNav />
      <WhatsAppButton />
    </CatalogProvider>
  );
}
