"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { PackagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Overlay";
import { Input, Textarea } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Alert } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { ImageUploader } from "@/components/admin/ImageUploader";
import {
  CardThumb, ConfirmDeleteModal, ReorderButtons, VisibilityButton,
} from "@/components/admin/TaxonomyManager";
import { api } from "@/lib/api/client";
import { useAction } from "@/lib/use-action";
import { isLocalUpload } from "@/lib/media";
import { toPersianDigits } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdminCollectionRow } from "@/server/services/taxonomy";

/**
 * Collection management — the same shape as the category manager: card image,
 * title, subtitle, order and visibility, plus product assignment.
 *
 * A product belongs to exactly one collection, so "assign" moves a product
 * here from wherever it was. Removing a product from a collection means
 * assigning it to another one, which is why there is no bare "remove".
 */
export function CollectionManager({ collections }: { collections: AdminCollectionRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<AdminCollectionRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<AdminCollectionRow | null>(null);
  const [assigning, setAssigning] = useState<AdminCollectionRow | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  const rows = order
    ? order.map((id) => collections.find((c) => c.id === id)).filter((c): c is AdminCollectionRow => Boolean(c))
    : collections;

  const remove = useAction(
    async (id: string) => api.delete<{ action: string; message: string }>(`/api/v1/admin/collections/${id}`),
    {
      onSuccess: (result) => {
        setDeleting(null);
        toast({
          tone: result.action === "deleted" ? "success" : "info",
          title: result.action === "deleted" ? "کالکشن حذف شد" : "کالکشن غیرفعال شد",
          description: result.message,
        });
        router.refresh();
      },
      onError: (message) => toast({ tone: "error", title: "حذف انجام نشد", description: message }),
    }
  );

  const toggle = useAction(
    async (row: AdminCollectionRow) => api.patch(`/api/v1/admin/collections/${row.id}`, { active: !row.active }),
    {
      onSuccess: () => router.refresh(),
      onError: (message) => toast({ tone: "error", title: "تغییر انجام نشد", description: message }),
    }
  );

  const reorder = useAction(
    async (ids: string[]) => api.post("/api/v1/admin/collections/reorder", { ids }),
    {
      onSuccess: () => { router.refresh(); },
      onError: (message) => {
        setOrder(null);
        toast({ tone: "error", title: "ترتیب ذخیره نشد", description: message });
      },
    }
  );

  const move = (index: number, to: number) => {
    if (to < 0 || to >= rows.length) return;
    const ids = rows.map((c) => c.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(to, 0, moved);
    setOrder(ids);
    void reorder.run(ids);
  };

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="font-bold text-fg">کالکشن‌ها</h2>
          <p className="mt-1 text-xs text-fg-muted">
            کالکشن‌های فعال به همین ترتیب در صفحه اصلی نمایش داده می‌شوند.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)} icon={<Plus className="size-4" aria-hidden />}>
          افزودن کالکشن
        </Button>
      </div>

      <ul className="divide-y divide-border">
        {rows.map((row, index) => (
          <li key={row.id} className={cn("flex flex-wrap items-center gap-3 p-4", !row.active && "opacity-70")}>
            <ReorderButtons
              label={row.name}
              first={index === 0}
              last={index === rows.length - 1}
              disabled={reorder.pending}
              onUp={() => move(index, index - 1)}
              onDown={() => move(index, index + 1)}
            />
            <CardThumb src={row.image} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium text-fg">
                {row.name}
                {!row.active && <Badge tone="neutral" size="sm">غیرفعال</Badge>}
              </p>
              <p className="mt-0.5 text-xs text-fg-subtle" dir="ltr">/collection/{row.slug}</p>
              {row.description && <p className="mt-1 line-clamp-1 text-xs text-fg-muted">{row.description}</p>}
            </div>
            <span className="tnum whitespace-nowrap text-xs text-fg-muted">
              {toPersianDigits(row.productCount)} محصول
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setAssigning(row)}
                aria-label={`افزودن محصول به ${row.name}`}
                title="محصولات کالکشن"
                className="grid size-9 place-items-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-fg"
              >
                <PackagePlus className="size-4" aria-hidden />
              </button>
              <VisibilityButton
                visible={row.active}
                label={row.name}
                disabled={toggle.pending}
                onClick={() => void toggle.run(row)}
              />
              <button
                type="button"
                onClick={() => setEditing(row)}
                aria-label={`ویرایش ${row.name}`}
                className="grid size-9 place-items-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-fg"
              >
                <Pencil className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setDeleting(row)}
                aria-label={`حذف ${row.name}`}
                className="grid size-9 place-items-center rounded-md text-fg-subtle hover:bg-danger-soft hover:text-danger"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {collections.length === 0 && (
        <p className="p-6 text-center text-sm text-fg-muted">هنوز کالکشنی تعریف نشده است.</p>
      )}

      <CollectionModal
        open={creating || editing !== null}
        collection={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onDone={() => { setCreating(false); setEditing(null); setOrder(null); router.refresh(); }}
      />

      <AssignProductsModal
        collection={assigning}
        onClose={() => setAssigning(null)}
        onDone={() => router.refresh()}
      />

      <ConfirmDeleteModal
        open={deleting !== null}
        title="حذف کالکشن"
        pending={remove.pending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && void remove.run(deleting.id)}
        message={
          deleting
            ? deleting.productCount > 0
              ? `«${deleting.name}» ${toPersianDigits(deleting.productCount)} محصول دارد. به‌جای حذف، غیرفعال می‌شود و از صفحه اصلی برداشته می‌شود؛ محصول‌ها حذف نمی‌شوند.`
              : `کالکشن «${deleting.name}» برای همیشه حذف شود؟`
            : ""
        }
      />
    </Card>
  );
}

function CollectionModal({
  open, collection, onClose, onDone,
}: {
  open: boolean;
  collection: AdminCollectionRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [seeded, setSeeded] = useState<string | null>(null);
  const key = collection?.id ?? "new";
  if (open && seeded !== key) {
    setSeeded(key);
    setName(collection?.name ?? "");
    setSlug(collection?.slug ?? "");
    setDescription(collection?.description ?? "");
    setImage(collection?.image ? [collection.image] : []);
    setActive(collection?.active ?? true);
    setError(null);
  }
  if (!open && seeded !== null) setSeeded(null);

  const save = useAction(
    async () => {
      const payload = {
        name: name.trim(),
        slug: slug.trim() || undefined,
        description: description.trim(),
        image: image[0] ?? "",
        active,
      };
      return collection
        ? api.patch(`/api/v1/admin/collections/${collection.id}`, payload)
        : api.post("/api/v1/admin/collections", payload);
    },
    {
      onSuccess: () => {
        toast({ tone: "success", title: collection ? "کالکشن ویرایش شد" : "کالکشن ایجاد شد" });
        onDone();
      },
    }
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={collection ? "ویرایش کالکشن" : "افزودن کالکشن"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={save.pending}>انصراف</Button>
          <Button type="submit" form="collection-form" loading={save.pending} disabled={save.pending || uploading}>
            ذخیره
          </Button>
        </div>
      }
    >
      <form
        id="collection-form"
        noValidate
        className="space-y-4"
        aria-busy={save.pending}
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim().length < 2) { setError("نام کالکشن را وارد کنید."); return; }
          setError(null);
          void save.run();
        }}
      >
        <Input
          label="عنوان"
          required
          value={name}
          onChange={(e) => { setName(e.target.value); if (error) setError(null); }}
          error={error ?? undefined}
          disabled={save.pending}
          autoComplete="off"
        />
        <Textarea
          label="زیرعنوان"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          hint="زیر عنوان کارت کالکشن در صفحه اصلی نمایش داده می‌شود."
          disabled={save.pending}
        />
        <div>
          <p className="mb-1.5 text-sm font-medium text-fg">تصویر کارت</p>
          <ImageUploader
            images={image}
            onChange={setImage}
            onUploadingChange={setUploading}
            folder="collections"
            max={1}
            disabled={save.pending}
            hint="پیش‌نمایش پیش از ذخیره نمایش داده می‌شود. بدون تصویر، عکس پرفروش‌ترین محصول کالکشن استفاده می‌شود."
          />
        </div>
        <Input
          label="نشانی (slug)"
          dir="ltr"
          className="[&_input]:text-start"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          hint="خالی بگذارید تا از روی نام ساخته شود."
          disabled={save.pending}
          autoComplete="off"
        />
        <Checkbox
          label="فعال (نمایش در فروشگاه)"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          disabled={save.pending}
        />
        {save.error && <Alert tone="danger" role="alert">{save.error}</Alert>}
      </form>
    </Modal>
  );
}

interface ProductHit {
  id: string;
  slug: string;
  name: string;
  image: string;
  brandName?: string;
  active: boolean;
}

/** Lists the collection's products and moves searched-for products into it. */
function AssignProductsModal({
  collection, onClose, onDone,
}: {
  collection: AdminCollectionRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [members, setMembers] = useState<ProductHit[] | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const id = collection?.id;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setMembers(null);
    setChosen([]);
    setQuery("");
    setHits([]);
    api
      .get<{ products: ProductHit[] }>(`/api/v1/admin/collections/${id}/products`)
      .then((r) => { if (!cancelled) setMembers(r.products); })
      .catch(() => { if (!cancelled) setMembers([]); });
    return () => { cancelled = true; };
  }, [id]);

  // Debounced search; typing never re-creates the input, so focus stays put.
  useEffect(() => {
    if (!id) return;
    const q = query.trim();
    if (q.length < 2) { setHits([]); return; }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      api
        .get<{ items: ProductHit[] }>(`/api/v1/admin/products?q=${encodeURIComponent(q)}&pageSize=20`)
        .then((r) => { if (!cancelled) setHits(r.items); })
        .catch(() => { if (!cancelled) setHits([]); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, id]);

  const assign = useAction(
    async () => api.put<{ moved: number }>(`/api/v1/admin/collections/${id}/products`, { productIds: chosen }),
    {
      onSuccess: (result) => {
        toast({ tone: "success", title: `${toPersianDigits(result.moved)} محصول به کالکشن اضافه شد` });
        onDone();
        onClose();
      },
      onError: (message) => toast({ tone: "error", title: "انتقال انجام نشد", description: message }),
    }
  );

  const memberIds = new Set((members ?? []).map((m) => m.id));
  const candidates = hits.filter((h) => !memberIds.has(h.id));

  return (
    <Modal
      open={collection !== null}
      onClose={onClose}
      title={collection ? `محصولات «${collection.name}»` : ""}
      description="هر محصول فقط در یک کالکشن است؛ افزودن، محصول را از کالکشن قبلی‌اش به اینجا منتقل می‌کند."
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={assign.pending}>بستن</Button>
          <Button
            onClick={() => void assign.run()}
            loading={assign.pending}
            disabled={assign.pending || chosen.length === 0}
            icon={<PackagePlus className="size-4" aria-hidden />}
          >
            افزودن {chosen.length ? toPersianDigits(chosen.length) : ""} محصول
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label="جست‌وجوی محصول"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="نام محصول یا کد کالا"
          autoComplete="off"
          hint={searching ? "در حال جست‌وجو…" : undefined}
        />

        {candidates.length > 0 && (
          <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border">
            {candidates.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                <Checkbox
                  label=""
                  aria-label={`انتخاب ${p.name}`}
                  checked={chosen.includes(p.id)}
                  onChange={(e) =>
                    setChosen((c) => (e.target.checked ? [...c, p.id] : c.filter((x) => x !== p.id)))
                  }
                />
                <ProductThumb src={p.image} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-fg">{p.name}</span>
                  {p.brandName && <span className="block text-xs text-fg-subtle">اکنون در: {p.brandName}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div>
          <h3 className="mb-2 text-sm font-bold text-fg">
            محصولات فعلی {members ? `(${toPersianDigits(members.length)})` : ""}
          </h3>
          {members === null ? (
            <p className="text-sm text-fg-muted">در حال بارگذاری…</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-fg-muted">هنوز محصولی در این کالکشن نیست.</p>
          ) : (
            <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border">
              {members.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                  <ProductThumb src={p.image} />
                  <span className="min-w-0 flex-1 truncate text-sm text-fg">{p.name}</span>
                  {!p.active && <Badge tone="neutral" size="sm">غیرفعال</Badge>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ProductThumb({ src }: { src: string }) {
  return (
    <span className="relative size-10 shrink-0 overflow-hidden rounded-md bg-surface-inset">
      {src && <Image src={src} unoptimized={isLocalUpload(src)} alt="" fill sizes="40px" className="object-cover" />}
    </span>
  );
}
