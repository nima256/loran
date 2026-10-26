# `src/data`

Seed and reference input only. **Nothing here is read at runtime.**

| File | What it is | Who reads it |
| --- | --- | --- |
| `catalog.json` | The reference catalogue — 100 products with their colourways, variants and reviews. | `prisma/seed.ts`, at seed time only. |
| `provinces.ts` | Iranian provinces and their major cities. | The address forms, directly. |

## Why `catalog.json` is not imported by the app

It used to be. `src/data/catalog.ts` wrapped it in typed exports, and
`src/lib/navigation.ts` imported those to build the category menu — which meant
the header imported it, which meant **every storefront page shipped the entire
634 KB catalogue into the browser bundle.**

The catalogue now lives in PostgreSQL. This JSON is what the seed loads to put
it there:

```bash
npm run db:seed
```

The seed is idempotent — every write is an upsert — so re-running it updates
the seeded rows in place rather than duplicating them. It will not touch
products an administrator created through the panel.

There is deliberately no typed accessor module beside the JSON any more. Adding
one would make it importable again, and the next person to reach for
"just the category names" would quietly reintroduce the bundle leak. Catalogue
reads go through `src/server/services/catalog.ts`, which is `server-only` — a
client component that imports it fails the build rather than shipping the
catalogue.

## Why `provinces.ts` is still a module

Province and city lists change on the order of decades, nobody administers
them, and an address form needs them synchronously while the customer types.
They are genuinely static reference data, which is the one category of thing
that belongs here.
