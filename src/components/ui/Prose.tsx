import { Breadcrumbs } from "./Navigation";
import { Alert } from "./Feedback";

/**
 * Shared shell for policy and information pages.
 *
 * `draft` marks copy that is placeholder text awaiting the business's final
 * wording — it renders a visible notice so nobody mistakes it for binding terms.
 */
export function ContentPage({
  title, lead, breadcrumb, draft, children, aside,
}: {
  title: string;
  lead?: string;
  breadcrumb: string;
  draft?: boolean;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="container-page py-6 lg:py-8">
      <Breadcrumbs className="mb-5" items={[{ label: "خانه", href: "/" }, { label: breadcrumb }]} />

      <header className="max-w-2xl">
        <h1 className="text-2xl font-bold text-fg sm:text-3xl">{title}</h1>
        {lead && <p className="mt-3 text-base leading-9 text-fg-muted">{lead}</p>}
      </header>

      {draft && (
        <Alert tone="warning" className="mt-6 max-w-3xl" title="متن نمونه — پیش از انتشار جایگزین شود">
          محتوای این صفحه به‌عنوان ساختار اولیه نوشته شده است. متن نهایی حقوقی و شرایط کسب‌وکار
          باید توسط لوران جایگزین شود.
        </Alert>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="prose-loran min-w-0 max-w-3xl">{children}</div>
        {aside && <aside className="lg:sticky lg:top-[calc(var(--header-h)+1rem)]">{aside}</aside>}
      </div>
    </div>
  );
}

/** A numbered or titled section inside a content page. */
export function ContentSection({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border py-6 first:border-0 first:pt-0">
      <h2 className="text-lg font-bold text-fg">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-8 text-fg-muted">{children}</div>
    </section>
  );
}

/** Bulleted list with brand-coloured markers. */
export function ContentList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span aria-hidden className="mt-3 size-1.5 shrink-0 rounded-full bg-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
