import { ProductEditor, type ProductDraft } from "@/components/admin/ProductEditor";
import { getProductEditorOptions } from "@/server/services/taxonomy";

/** Admin → Products → Add product. */

export const dynamic = "force-dynamic";

const EMPTY: ProductDraft = {
  name: "",
  slug: "",
  subtitle: "",
  brandId: "",
  categoryIds: [],
  gender: "unisex",
  price: 0,
  compareAtPrice: null,
  description: "",
  features: [],
  specs: [],
  tags: [],
  active: true,
  colors: [],
  variants: [],
};

export default async function NewProductPage() {
  const options = await getProductEditorOptions();
  return <ProductEditor initial={EMPTY} options={options} mode="create" />;
}
