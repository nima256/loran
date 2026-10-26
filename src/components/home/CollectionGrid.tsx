import { CardTile } from "./CategoryGrid";
import { toPersianDigits } from "@/lib/format";
import type { Brand } from "@/types";

/** Homepage collection cards, in the order set in admin → collections. */
export function CollectionGrid({ collections }: { collections: Brand[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {collections.map((collection) => (
        <CardTile
          key={collection.id}
          href={`/collection/${collection.slug}`}
          image={collection.image}
          title={collection.name}
          subtitle={collection.description}
          meta={collection.productCount != null ? `${toPersianDigits(collection.productCount)} محصول` : undefined}
        />
      ))}
    </div>
  );
}
