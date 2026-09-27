"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, CreditCard, Lock, MapPin, Pencil, Plus, ShoppingBag, Truck,
} from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Checkbox, RadioCard } from "@/components/ui/Checkbox";
import { Stepper } from "@/components/ui/Navigation";
import { Alert, EmptyState, Skeleton } from "@/components/ui/Feedback";
import { Modal } from "@/components/ui/Overlay";
import { PriceInline } from "@/components/ui/Price";
import { CouponField } from "@/components/cart/CouponField";
import { OrderSummary } from "@/components/cart/OrderSummary";
import { AddressForm } from "@/components/account/AddressForm";
import { useCart } from "@/store/CartProvider";
import { useAuth } from "@/store/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { useAction } from "@/lib/use-action";
import { formatPhone, toPersianDigits } from "@/lib/format";

const STEPS = ["آدرس تحویل", "ارسال و پرداخت", "بررسی نهایی"];

/**
 * Checkout.
 *
 * Three logical steps on one route — the URL never changes, so the browser back
 * button leaves checkout rather than stranding the user mid-flow, and the order
 * summary stays visible the whole time.
 *
 * Nothing about money is decided here. The totals shown come from the server's
 * cart validation, and placing the order sends only variant ids, quantities and
 * the chosen address — the server reloads every price and recomputes the
 * amount before it creates anything.
 */
export default function CheckoutPage() {
  const router = useRouter();
  const { toast } = useToast();
  const {
    items, totals, coupon, shippingMethodId, setShippingMethodId, shippingMethods,
    hydrating, validating, issues, revalidate, clear,
  } = useCart();
  const { isAuthenticated, hydrating: authLoading, user, addresses, addAddress } = useAuth();

  const [step, setStep] = useState(0);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  // ZarinPal is the only live gateway; the field exists for the order record.
  const [payment, setPayment] = useState("online");
  const [smsUpdates, setSmsUpdates] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsError, setTermsError] = useState(false);

  // Purchasing requires an account — this is a business rule, not a convenience.
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/auth/login?redirect=/checkout");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (addressId === null && addresses.length) {
      setAddressId((addresses.find((a) => a.isDefault) ?? addresses[0]).id);
    }
  }, [addresses, addressId]);

  /**
   * Places the order.
   *
   * Sends identifiers and quantities only. The server reprices everything from
   * the database, generates the order number, creates a pending order and
   * hands back the gateway URL — the browser never invents an order number and
   * never states an amount.
   *
   * `useAction` holds an in-flight guard in a ref, so an impatient double-click
   * cannot produce two orders.
   */
  const place = useAction(
    async () => {
      // One last repricing, so a stale tab is caught before the payment starts
      // rather than after.
      const fresh = await revalidate();
      if (fresh && (fresh.issues.some((i) => i.code !== "price_changed") || fresh.removed.length)) {
        throw new Error("سبد خرید شما تغییر کرده است. لطفاً قبل از پرداخت آن را بازبینی کنید.");
      }

      return api.post<{ orderNumber: string; paymentUrl?: string; redirectUrl: string }>(
        "/api/v1/checkout",
        {
          items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
          addressId,
          shippingMethodCode: shippingMethodId,
          couponCode: coupon?.code,
          note: undefined,
          paymentMethod: "online",
        }
      );
    },
    {
      onSuccess: (result) => {
        clear();
        if (result.paymentUrl) {
          // A full navigation, not a router push: the gateway is off-origin.
          window.location.href = result.paymentUrl;
          return;
        }
        router.push(result.redirectUrl);
      },
      onError: (message) =>
        toast({ tone: "error", title: "ثبت سفارش انجام نشد", description: message }),
    }
  );

  const address = useMemo(() => addresses.find((a) => a.id === addressId), [addresses, addressId]);
  const method = shippingMethods.find((m) => m.id === shippingMethodId) ?? shippingMethods[0];
  const blockingIssues = issues.filter((i) => i.code !== "price_changed");

  if (authLoading || hydrating) {
    return (
      <div className="container-page py-8 space-y-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <Skeleton className="h-96 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  if (items.length === 0) {
    return (
      <div className="container-page py-10">
        <EmptyState
          icon={<ShoppingBag className="size-7" aria-hidden />}
          title="سبد خرید شما خالی است"
          description="برای تکمیل خرید ابتدا چند کالا به سبد اضافه کنید."
          action={<ButtonLink href="/shop">رفتن به فروشگاه</ButtonLink>}
        />
      </div>
    );
  }

  const goNext = () => {
    if (step === 0 && !address) {
      toast({ tone: "error", title: "آدرس تحویل انتخاب نشده", description: "یک آدرس انتخاب یا اضافه کنید." });
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const placeOrder = () => {
    if (!termsAccepted) {
      setTermsError(true);
      document.getElementById("terms")?.focus();
      return;
    }
    if (!addressId) {
      toast({ tone: "error", title: "آدرس تحویل را انتخاب کنید" });
      setStep(0);
      return;
    }
    void place.run();
  };

  return (
    <div className="container-page py-6 lg:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-fg sm:text-3xl">تکمیل خرید</h1>
        <Link href="/cart" className="inline-flex min-h-9 items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
          <ArrowRight className="size-4" aria-hidden />
          بازگشت به سبد خرید
        </Link>
      </div>

      <Stepper steps={STEPS} current={step} className="mb-8" />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-8">
        <div className="min-w-0 space-y-6">
          {/* ---------- Step 1: address ---------- */}
          {step === 0 && (
            <section aria-labelledby="step-address" className="rounded-lg border border-border bg-surface p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 id="step-address" className="flex items-center gap-2 font-bold text-fg">
                  <MapPin className="size-5 text-fg-subtle" aria-hidden />
                  آدرس تحویل سفارش
                </h2>
                <Button variant="secondary" size="sm" onClick={() => setAddressModalOpen(true)} icon={<Plus className="size-4" aria-hidden />}>
                  آدرس جدید
                </Button>
              </div>

              {addresses.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center">
                  <p className="font-medium text-fg">هنوز آدرسی ثبت نکرده‌اید</p>
                  <p className="mt-1.5 text-sm text-fg-muted">برای ارسال سفارش، یک آدرس تحویل اضافه کنید.</p>
                  <Button className="mt-4" onClick={() => setAddressModalOpen(true)} icon={<Plus className="size-4" aria-hidden />}>
                    افزودن آدرس
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses.map((a) => (
                    <RadioCard
                      key={a.id}
                      name="address"
                      value={a.id}
                      checked={a.id === addressId}
                      onChange={setAddressId}
                      badge={a.isDefault ? <Badge tone="brand" size="sm">پیش‌فرض</Badge> : undefined}
                      title={a.title}
                      description={
                        <>
                          <span className="block">{a.province}، {a.city}، {a.addressLine}</span>
                          <span className="tnum mt-1 block text-fg-subtle">
                            {a.plaque && `پلاک ${a.plaque}`}
                            {a.unit && `، واحد ${a.unit}`}
                            {`، کد پستی ${toPersianDigits(a.postalCode)}`}
                          </span>
                          <span className="tnum mt-1 block text-fg-subtle">
                            گیرنده: {a.recipientFirstName} {a.recipientLastName} — {formatPhone(a.phone)}
                          </span>
                        </>
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ---------- Step 2: shipping + payment ---------- */}
          {step === 1 && (
            <>
              <section aria-labelledby="step-shipping" className="rounded-lg border border-border bg-surface p-4 sm:p-5">
                <h2 id="step-shipping" className="mb-4 flex items-center gap-2 font-bold text-fg">
                  <Truck className="size-5 text-fg-subtle" aria-hidden />
                  شیوه ارسال
                </h2>
                <div className="space-y-3">
                  {shippingMethods.map((m) => (
                    <RadioCard
                      key={m.id}
                      name="shipping"
                      value={m.id}
                      checked={m.id === shippingMethodId}
                      disabled={!m.available || place.pending}
                      onChange={(value) => setShippingMethodId(value as typeof shippingMethodId)}
                      badge={
                        !m.available ? <Badge tone="neutral" size="sm">به‌زودی</Badge>
                        : m.paidOnDelivery ? <Badge tone="warning" size="sm">پرداخت هنگام تحویل</Badge>
                        : undefined
                      }
                      title={m.name}
                      description={m.description}
                      footer={
                        <span className="tnum text-xs text-fg-subtle">
                          زمان تقریبی تحویل: {m.estimate}
                          {!m.paidOnDelivery && m.cost > 0 && `، ${m.cost.toLocaleString("fa-IR")} تومان`}
                        </span>
                      }
                    />
                  ))}
                </div>

                {method.paidOnDelivery && (
                  <Alert tone="warning" className="mt-4" title="هزینه ارسال جداگانه دریافت می‌شود">
                    مبلغی که الان آنلاین پرداخت می‌کنید فقط بابت کالاهاست. کرایه تیپاکس را هنگام
                    تحویل مرسوله، مستقیماً به مأمور تیپاکس می‌پردازید.
                  </Alert>
                )}
              </section>

              <section aria-labelledby="step-payment" className="rounded-lg border border-border bg-surface p-4 sm:p-5">
                <h2 id="step-payment" className="mb-4 flex items-center gap-2 font-bold text-fg">
                  <CreditCard className="size-5 text-fg-subtle" aria-hidden />
                  روش پرداخت
                </h2>
                <div className="space-y-3">
                  <RadioCard
                    name="payment"
                    value="online"
                    checked={payment === "online"}
                    onChange={(v) => setPayment(v)}
                    title="پرداخت اینترنتی"
                    description="انتقال به درگاه بانکی و پرداخت با کارت‌های عضو شتاب."
                  />
                  {/* Reserved slots for the two BNPL providers. Deliberately inert:
                      there is no integration, so the UI must not imply one. */}
                  <RadioCard
                    name="payment"
                    value="snapppay"
                    checked={false}
                    disabled
                    onChange={() => {}}
                    badge={<Badge tone="neutral" size="sm">به‌زودی</Badge>}
                    title="اسنپ‌پی — خرید اعتباری"
                    description="پرداخت قسطی از طریق اعتبار اسنپ‌پی. این روش هنوز فعال نشده است."
                  />
                  <RadioCard
                    name="payment"
                    value="torobpay"
                    checked={false}
                    disabled
                    onChange={() => {}}
                    badge={<Badge tone="neutral" size="sm">به‌زودی</Badge>}
                    title="ترب‌پی — خرید اعتباری"
                    description="پرداخت اعتباری از طریق ترب‌پی. این روش هنوز فعال نشده است."
                  />
                </div>
              </section>

              <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
                <h2 className="mb-3 font-bold text-fg">اطلاع‌رسانی سفارش</h2>
                <Checkbox
                  label="وضعیت سفارش را برایم پیامک کنید"
                  hint={`پیامک‌ها به شماره ${user ? formatPhone(user.phone) : ""} ارسال می‌شود.`}
                  checked={smsUpdates}
                  onChange={(e) => setSmsUpdates(e.target.checked)}
                />
              </section>
            </>
          )}

          {/* ---------- Step 3: review ---------- */}
          {step === 2 && (
            <>
              <section aria-labelledby="review-items" className="rounded-lg border border-border bg-surface">
                <h2 id="review-items" className="border-b border-border p-4 font-bold text-fg sm:p-5">
                  کالاهای سفارش ({toPersianDigits(items.length)} مورد)
                </h2>
                <ul className="divide-y divide-border">
                  {items.map((item) => (
                    <li key={item.variantId} className="flex gap-3 p-4">
                      <span className="relative size-16 shrink-0 overflow-hidden rounded-md bg-surface-inset">
                        <Image src={item.image} alt="" fill sizes="64px" className="object-cover" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium text-fg">{item.name}</p>
                        <p className="tnum mt-1 text-xs text-fg-muted">
                          {item.colorName}، سایز {toPersianDigits(item.size)}، {toPersianDigits(item.quantity)} عدد
                        </p>
                      </div>
                      <PriceInline value={item.price * item.quantity} className="shrink-0 text-sm" />
                    </li>
                  ))}
                </ul>
              </section>

              <div className="grid gap-4 sm:grid-cols-2">
                <ReviewCard title="آدرس تحویل" onEdit={() => setStep(0)}>
                  {address ? (
                    <>
                      <p className="font-medium text-fg">{address.title}</p>
                      <p className="mt-1 leading-7">{address.province}، {address.city}، {address.addressLine}</p>
                      <p className="tnum mt-1 text-fg-subtle">
                        {address.recipientFirstName} {address.recipientLastName} — {formatPhone(address.phone)}
                      </p>
                    </>
                  ) : <p>آدرسی انتخاب نشده است.</p>}
                </ReviewCard>

                <ReviewCard title="ارسال و پرداخت" onEdit={() => setStep(1)}>
                  <p className="font-medium text-fg">{method.name}</p>
                  <p className="mt-1">{method.estimate}</p>
                  <p className="mt-2 font-medium text-fg">پرداخت اینترنتی</p>
                  <p className="mt-1">{smsUpdates ? "پیامک وضعیت سفارش فعال است." : "پیامک وضعیت سفارش غیرفعال است."}</p>
                </ReviewCard>
              </div>

              <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
                <div id="terms-wrap">
                  <Checkbox
                    id="terms"
                    label={
                      <>
                        <Link href="/terms" target="_blank" className="text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]">
                          قوانین و مقررات
                        </Link>
                        {" "}و{" "}
                        <Link href="/returns" target="_blank" className="text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]">
                          شرایط مرجوعی
                        </Link>
                        {" "}لوران را خوانده‌ام و می‌پذیرم.
                      </>
                    }
                    checked={termsAccepted}
                    onChange={(e) => { setTermsAccepted(e.target.checked); setTermsError(false); }}
                  />
                </div>
                {termsError && (
                  <p role="alert" className="mt-1 text-sm text-danger">
                    برای ثبت سفارش، پذیرش قوانین الزامی است.
                  </p>
                )}
              </section>
            </>
          )}

          {/* Anything the server changed under the customer — a price move or a
              size that sold out — is said here rather than silently applied. */}
          {issues.length > 0 && (
            <Alert
              tone={blockingIssues.length ? "warning" : "info"}
              role="status"
              title={blockingIssues.length ? "سبد خرید شما تغییر کرده است" : "توجه"}
            >
              <ul className="space-y-1">
                {issues.map((issue, index) => (
                  <li key={`${issue.variantId}-${index}`}>{issue.message}</li>
                ))}
              </ul>
              {blockingIssues.length > 0 && (
                <Link
                  href="/cart"
                  className="mt-2 inline-flex min-h-9 items-center gap-1 font-medium text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]"
                >
                  بازبینی سبد خرید
                  <ArrowLeft className="size-3.5" aria-hidden />
                </Link>
              )}
            </Alert>
          )}

          {place.error && <Alert tone="danger" role="alert">{place.error}</Alert>}

          {/* Step navigation */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {step > 0 ? (
              <Button variant="ghost" onClick={goBack} icon={<ArrowRight className="size-4" aria-hidden />}>
                مرحله قبل
              </Button>
            ) : <span />}

            {step < STEPS.length - 1 ? (
              <Button size="lg" onClick={goNext} iconEnd={<ArrowLeft className="size-4" aria-hidden />}>
                ادامه
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={placeOrder}
                loading={place.pending}
                disabled={place.pending || validating || blockingIssues.length > 0}
                icon={<Lock className="size-4" aria-hidden />}
              >
                {place.pending ? "در حال انتقال به درگاه…" : "پرداخت و ثبت نهایی سفارش"}
              </Button>
            )}
          </div>
        </div>

        {/* Persistent summary */}
        <div className="space-y-4 lg:sticky lg:top-[calc(var(--header-h)+1rem)]">
          {step < 2 && (
            <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
              <CouponField />
            </div>
          )}
          <OrderSummary totals={totals} couponCode={coupon?.code} shippingMethodId={shippingMethodId} />
        </div>
      </div>

      <Modal
        open={addressModalOpen}
        onClose={() => setAddressModalOpen(false)}
        title="افزودن آدرس جدید"
        description="این آدرس در حساب شما ذخیره می‌شود و بعداً هم قابل استفاده است."
        size="lg"
      >
        <AddressForm
          initial={{
            recipientFirstName: user?.firstName,
            recipientLastName: user?.lastName,
            phone: user?.phone,
            isDefault: addresses.length === 0,
          }}
          onSubmit={async (data) => {
            const created = await addAddress(data);
            setAddressId(created.id);
            setAddressModalOpen(false);
            toast({ tone: "success", title: "آدرس جدید ثبت شد" });
          }}
          onCancel={() => setAddressModalOpen(false)}
        />
      </Modal>
    </div>
  );
}

function ReviewCard({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="font-bold text-fg">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex min-h-9 items-center gap-1 text-sm text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]"
        >
          <Pencil className="size-3.5" aria-hidden />
          ویرایش
        </button>
      </div>
      <div className="text-sm text-fg-muted">{children}</div>
    </section>
  );
}
