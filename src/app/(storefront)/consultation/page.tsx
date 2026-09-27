import type { Metadata } from "next";
import { ConsultationForm } from "@/components/storefront/ConsultationForm";
import { listCategories } from "@/server/services/catalog";
import { listSizes } from "@/server/services/taxonomy";

/**
 * Size and model consultation.
 *
 * The categories and sizes offered are the real ones, loaded here on the
 * server — the form is a client component and must not import the catalogue,
 * or it would ship the whole thing to the browser.
 */

export const metadata: Metadata = {
  title: "درخواست مشاوره سایز و مدل",
  description: "کارشناسان لوران در انتخاب سایز و مدل مناسب کنارتان هستند. مشاوره رایگان است.",
};

export const dynamic = "force-dynamic";

export default async function ConsultationPage() {
  const [categories, sizes] = await Promise.all([listCategories(), listSizes()]);

  return (
    <ConsultationForm
      categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
      sizes={sizes.map((s) => s.value)}
    />
  );
}
