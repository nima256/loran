"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Check, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Alert, EmptyState, Skeleton } from "@/components/ui/Feedback";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { PriceInline } from "@/components/ui/Price";
import { useToast } from "@/components/ui/Toast";
import { api, query as buildQuery } from "@/lib/api/client";
import { useAction } from "@/lib/use-action";
import { provinces } from "@/data/provinces";
import { formatAmount, toPersianDigits } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ShippingMethod } from "@/types";

/**
 * The manual-order form.
 *
 * The product picker shows live stock for every colour/size, so the
 * administrator cannot pick an unavailable combination in the first place. The
 * server re-checks everything on submit regardless: prices are reloaded from
 * the database and stock is decremented in the same transaction as the order,
 * so nothing entered here decides a price or lets stock go negative.
 */

interface PickerVariant {
  id: string;
  sku: string;
  colorId: string;
  colorName: string;
  size: number;
  stock: number;
  price: number;
  inStock: boolean;
}

interface PickerProduct {
  id: string;
  slug: string;
  name: string;
  price: number;
  image: string;
  colors: { id: string; name: string; hex: string; image: string }[];
  variants: PickerVariant[];
}

interface Line {
  variantId: string;
  productName: string;
  colorName: string;
  size: number;
  sku: string;
  price: number;
  stock: number;
  quantity: number;
  image: string;
}

const STATUS_OPTIONS = [
  { value: "preparing", label: "در حال آماده‌سازی" },
  { value: "awaiting_payment", label: "در انتظار پرداخت" },
  { value: "packaged", label: "بسته‌بندی شد" },
  { value: "shipped", label: "ارسال شد" },
  { value: "delivered", label: "تحویل داده شد" },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "paid", label: "پرداخت شده" },
  { value: "pending", label: "پرداخت نشده" },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "نقدی / حضوری" },
  { value: "card", label: "کارت به کارت" },
  { value: "pos", label: "دستگاه کارت‌خوان" },
  { value: "cod", label: "پرداخت در محل" },
];

export function ManualOrderForm({ shippingMethods }: { shippingMethods: ShippingMethod[] }) {
  const router = useRouter();
  const { toast } = useToast();

  /* ------------------------------------------------------- product picker -- */
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<PickerProduct[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const id = setTimeout(async () => {
      try {
        const data = await api.get<{ products: PickerProduct[] }>(
          `/api/v1/admin/orders/products${buildQuery({ q: search, limit: 12 })}`,
          { signal: controller.signal }
        );
        setProducts(data.products);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setProducts([]);
      }
    }, 300);
    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [search]);

  /* ---------------------------------------------------------------- lines -- */
  const [lines, setLines] = useState<Line[]>([]);

  const addVariant = (product: PickerProduct, variant: PickerVariant) => {
    if (!variant.inStock) return;
    setLines((current) => {
      const existing = current.find((l) => l.variantId === variant.id);
      if (existing) {
        // Topping up an existing line, capped at what is actually on the shelf.
        return current.map((l) =>
          l.variantId === variant.id
            ? { ...l, quantity: Math.min(l.quantity + 1, l.stock) }
            : l
        );
      }
      return [
        ...current,
        {
          variantId: variant.id,
          productName: product.name,
          colorName: variant.colorName,
          size: variant.size,
          sku: variant.sku,
          price: variant.price,
          stock: variant.stock,
          quantity: 1,
          image: product.colors.find((c) => c.id === variant.colorId)?.image ?? product.image,
        },
      ];
    });
  };

  const subtotal = useMemo(
    () => lines.reduce((n, l) => n + l.price * l.quantity, 0),
    [lines]
  );

  /* ----------------------------------------------------------- order form -- */
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [shippingMethodCode, setShippingMethodCode] = useState(shippingMethods[0]?.id ?? "");
  const [status, setStatus] = useState("preparing");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [discount, setDiscount] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const cities = useMemo(
    () => provinces.find((p) => p.name === province)?.cities ?? [],
    [province]
  );

  const submit = useAction(
    async () =>
      api.post<{ order: { number: string }; message: string }>("/api/v1/admin/orders/manual", {
        customer: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || undefined,
        },
        address: {
          province: province || undefined,
          city: city || undefined,
          addressLine: addressLine.trim() || undefined,
          postalCode: postalCode.trim() || undefined,
        },
        items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        shippingMethodCode: shippingMethodCode || undefined,
        status,
        paymentStatus,
        paymentMethod,
        discount: discount ? Number(discount) : undefined,
        customerNote: customerNote.trim() || undefined,
        adminNote: adminNote.trim() || undefined,
      }),
    {
      onSuccess: (result) => {
        toast({
          tone: "success",
          title: `سفارش ${result.order.number} ثبت شد`,
          description: result.message,
        });
        router.push(`/admin/orders/${result.order.number}`);
      },
      onError: (message) =>
        toast({ tone: "error", title: "ثبت سفارش انجام نشد", description: message }),
    }
  );

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (firstName.trim().length < 2) next.firstName = "نام مشتری را وارد کنید.";
    if (lastName.trim().length < 2) next.lastName = "نام خانوادگی مشتری را وارد کنید.";
    if (!lines.length) next.items = "حداقل یک کالا به سفارش اضافه کنید.";
    setErrors(next);
    if (Object.keys(next).length) return;
    void submit.run();
  };

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={submit.pending}>
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr] xl:items-start">
        <div className="space-y-4">
          {/* ------------------------------------------------ product picker */}
          <Card>
            <h2 className="mb-3 font-bold text-fg">انتخاب کالا</h2>
            <div className="relative">
              <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-fg-subtle" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="نام محصول یا کد کالا"
                aria-label="جست‌وجوی محصول"
                disabled={submit.pending}
                className="h-11 w-full rounded-md border border-border-strong bg-surface px-3 ps-10 text-sm
                           focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
            </div>

            <div className="mt-3 max-h-96 overflow-y-auto rounded-md border border-border">
              {products === null ? (
                <div className="space-y-2 p-3">
                  {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}
                </div>
              ) : products.length === 0 ? (
                <p className="p-6 text-center text-sm text-fg-muted">محصولی پیدا نشد.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {products.map((product) => {
                    const isOpen = expanded === product.id;
                    const inStockCount = product.variants.filter((v) => v.inStock).length;
                    return (
                      <li key={product.id}>
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : product.id)}
                          aria-expanded={isOpen}
                          className="flex w-full items-center gap-3 p-3 text-start hover:bg-surface-2"
                        >
                          <span className="relative size-12 shrink-0 overflow-hidden rounded-md bg-surface-inset">
                            {product.image && (
                              <Image src={product.image} alt="" fill sizes="48px" className="object-cover" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-1 block text-sm font-medium text-fg">
                              {product.name}
                            </span>
                            <span className="tnum mt-0.5 block text-xs text-fg-muted">
                              {formatAmount(product.price)} تومان —{" "}
                              {inStockCount > 0
                                ? `${toPersianDigits(inStockCount)} تنوع موجود`
                                : "ناموجود"}
                            </span>
                          </span>
                          <Plus className={cn("size-4 shrink-0 text-fg-subtle transition-transform", isOpen && "rotate-45")} aria-hidden />
                        </button>

                        {isOpen && (
                          <div className="border-t border-border bg-surface-2 p-3">
                            {/* Live stock per colour/size, so an unavailable
                                combination cannot be chosen by accident. */}
                            <div className="flex flex-wrap gap-1.5">
                              {product.variants.map((variant) => (
                                <button
                                  key={variant.id}
                                  type="button"
                                  onClick={() => addVariant(product, variant)}
                                  disabled={!variant.inStock || submit.pending}
                                  title={
                                    variant.inStock
                                      ? `${variant.colorName} / ${variant.size} — موجودی ${variant.stock}`
                                      : `${variant.colorName} / ${variant.size} — ناموجود`
                                  }
                                  className={cn(
                                    "tnum inline-flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors",
                                    variant.inStock
                                      ? "border-border bg-surface text-fg hover:border-primary hover:bg-primary-soft"
                                      : "cursor-not-allowed border-border bg-surface-3 text-fg-subtle line-through"
                                  )}
                                >
                                  <span>{variant.colorName}</span>
                                  <span className="font-bold">{toPersianDigits(variant.size)}</span>
                                  <span className={variant.stock <= 2 ? "text-warning" : "text-fg-subtle"}>
                                    ({toPersianDigits(variant.stock)})
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>

          {/* ------------------------------------------------------- lines */}
          <Card padded={false}>
            <h2 className="border-b border-border p-4 font-bold text-fg">
              اقلام سفارش ({toPersianDigits(lines.length)} مورد)
            </h2>

            {lines.length === 0 ? (
              <EmptyState
                className="border-0"
                icon={<ShoppingCart className="size-7" aria-hidden />}
                title="هنوز کالایی انتخاب نشده"
                description="از بخش بالا محصول و تنوع موردنظر را اضافه کنید."
              />
            ) : (
              <ul className="divide-y divide-border">
                {lines.map((line) => (
                  <li key={line.variantId} className="flex flex-wrap items-center gap-3 p-3">
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-md bg-surface-inset">
                      {line.image && <Image src={line.image} alt="" fill sizes="48px" className="object-cover" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-medium text-fg">{line.productName}</p>
                      <p className="tnum mt-0.5 text-xs text-fg-muted">
                        {line.colorName}، سایز {toPersianDigits(line.size)} —{" "}
                        <span dir="ltr">{line.sku}</span>
                      </p>
                    </div>
                    <QuantityStepper
                      value={line.quantity}
                      min={1}
                      max={line.stock}
                      onChange={(quantity) =>
                        setLines((current) =>
                          current.map((l) => (l.variantId === line.variantId ? { ...l, quantity } : l))
                        )
                      }
                      size="sm"
                    />
                    <PriceInline value={line.price * line.quantity} className="text-sm" />
                    <button
                      type="button"
                      onClick={() =>
                        setLines((current) => current.filter((l) => l.variantId !== line.variantId))
                      }
                      aria-label={`حذف ${line.productName}`}
                      className="grid size-9 place-items-center rounded-md text-fg-subtle hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {errors.items && (
              <p role="alert" className="border-t border-border p-3 text-sm text-danger">
                {errors.items}
              </p>
            )}
          </Card>

          {/* ---------------------------------------------------- customer */}
          <Card>
            <h2 className="mb-4 font-bold text-fg">اطلاعات مشتری</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="نام"
                required
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); setErrors((s) => ({ ...s, firstName: "" })); }}
                error={errors.firstName || undefined}
                disabled={submit.pending}
              />
              <Input
                label="نام خانوادگی"
                required
                value={lastName}
                onChange={(e) => { setLastName(e.target.value); setErrors((s) => ({ ...s, lastName: "" })); }}
                error={errors.lastName || undefined}
                disabled={submit.pending}
              />
              <Input
                label="شماره موبایل"
                dir="ltr"
                className="[&_input]:text-start"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09123456789"
                hint="اگر مشتری حساب کاربری داشته باشد، سفارش به حساب او متصل می‌شود."
                disabled={submit.pending}
              />
            </div>
          </Card>

          {/* ----------------------------------------------------- address */}
          <Card>
            <h2 className="mb-4 font-bold text-fg">نشانی تحویل (اختیاری)</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="استان"
                value={province}
                onChange={(e) => { setProvince(e.target.value); setCity(""); }}
                options={provinces.map((p) => ({ value: p.name, label: p.name }))}
                placeholder="انتخاب کنید"
                disabled={submit.pending}
              />
              <Select
                label="شهر"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                options={cities.map((c) => ({ value: c, label: c }))}
                placeholder={province ? "انتخاب کنید" : "ابتدا استان را انتخاب کنید"}
                disabled={submit.pending || !province}
              />
              <Input
                label="کد پستی"
                dir="ltr"
                className="[&_input]:text-start sm:col-span-1"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                disabled={submit.pending}
              />
            </div>
            <Textarea
              label="نشانی"
              className="mt-4"
              rows={2}
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              disabled={submit.pending}
            />
          </Card>
        </div>

        {/* ------------------------------------------------------- sidebar */}
        <div className="space-y-4">
          <Card>
            <h2 className="mb-4 font-bold text-fg">وضعیت سفارش</h2>
            <div className="space-y-4">
              <Select
                label="وضعیت اولیه"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                options={STATUS_OPTIONS}
                disabled={submit.pending}
              />
              <Select
                label="وضعیت پرداخت"
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                options={PAYMENT_STATUS_OPTIONS}
                disabled={submit.pending}
              />
              <Select
                label="روش پرداخت"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                options={PAYMENT_METHOD_OPTIONS}
                disabled={submit.pending}
              />
              <Select
                label="شیوه ارسال"
                value={shippingMethodCode}
                onChange={(e) => setShippingMethodCode(e.target.value)}
                options={shippingMethods.map((m) => ({ value: m.id, label: m.name }))}
                disabled={submit.pending}
              />
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 font-bold text-fg">مبلغ</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">جمع کالاها</dt>
                <dd><PriceInline value={subtotal} /></dd>
              </div>
            </dl>
            <Input
              label="تخفیف دستی (تومان)"
              className="mt-4"
              dir="ltr"
              inputMode="numeric"
              value={discount}
              onChange={(e) => setDiscount(e.target.value.replace(/\D/g, ""))}
              hint="در صورت توافق تلفنی با مشتری."
              disabled={submit.pending}
            />
            <p className="tnum mt-4 flex justify-between gap-3 border-t border-border pt-3 font-bold text-fg">
              <span>مبلغ نهایی</span>
              <span>{formatAmount(Math.max(0, subtotal - Number(discount || 0)))} تومان</span>
            </p>
            <p className="mt-2 text-xs text-fg-subtle">
              قیمت‌ها هنگام ثبت، دوباره از پایگاه داده خوانده و محاسبه می‌شوند.
            </p>
          </Card>

          <Card>
            <h2 className="mb-4 font-bold text-fg">یادداشت‌ها</h2>
            <Textarea
              label="یادداشت مشتری"
              rows={2}
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
              disabled={submit.pending}
            />
            <Textarea
              label="یادداشت داخلی"
              className="mt-4"
              rows={2}
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              hint="به مشتری نمایش داده نمی‌شود."
              disabled={submit.pending}
            />
          </Card>

          {submit.error && <Alert tone="danger" role="alert">{submit.error}</Alert>}

          <Alert tone="info">
            با ثبت این سفارش، موجودی انبار بلافاصله کسر می‌شود و سفارش در همه گزارش‌ها و فهرست‌ها
            مثل یک سفارش عادی دیده می‌شود.
          </Alert>

          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={submit.pending}
            disabled={submit.pending || lines.length === 0}
            icon={<Check className="size-4" aria-hidden />}
          >
            ثبت سفارش و کسر موجودی
          </Button>
        </div>
      </div>
    </form>
  );
}
