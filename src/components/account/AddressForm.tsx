"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Alert } from "@/components/ui/Feedback";
import { errorMessage } from "@/lib/api/client";
import { provinces } from "@/data/provinces";
import { isValidPhone, isValidPostalCode, toLatinDigits } from "@/lib/format";
import type { Address } from "@/types";

/**
 * Address form, shared by the checkout and the account's address book.
 *
 * Province → city is a dependent pair, and the postal code is validated as the
 * 10-digit Iranian format rather than accepted blindly.
 */
export function AddressForm({
  initial, onSubmit, onCancel, submitLabel = "ثبت آدرس",
}: {
  initial?: Partial<Address>;
  onSubmit: (address: Omit<Address, "id">) => void | Promise<unknown>;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [values, setValues] = useState({
    title: initial?.title ?? "",
    recipientFirstName: initial?.recipientFirstName ?? "",
    recipientLastName: initial?.recipientLastName ?? "",
    phone: initial?.phone ?? "",
    province: initial?.province ?? "",
    city: initial?.city ?? "",
    addressLine: initial?.addressLine ?? "",
    postalCode: initial?.postalCode ?? "",
    plaque: initial?.plaque ?? "",
    unit: initial?.unit ?? "",
    isDefault: initial?.isDefault ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const set = (key: keyof typeof values, value: string | boolean) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const cities = provinces.find((p) => p.name === values.province)?.cities ?? [];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!values.title.trim()) next.title = "یک عنوان برای این آدرس بنویسید. مثلاً «خانه».";
    if (!values.recipientFirstName.trim()) next.recipientFirstName = "نام گیرنده را وارد کنید.";
    if (!values.recipientLastName.trim()) next.recipientLastName = "نام خانوادگی گیرنده را وارد کنید.";
    if (!isValidPhone(values.phone)) next.phone = "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.";
    if (!values.province) next.province = "استان را انتخاب کنید.";
    if (!values.city) next.city = "شهر را انتخاب کنید.";
    if (values.addressLine.trim().length < 10) next.addressLine = "نشانی کامل‌تری بنویسید (خیابان، کوچه، ساختمان).";
    if (!isValidPostalCode(values.postalCode)) next.postalCode = "کد پستی باید دقیقاً ۱۰ رقم باشد.";

    setErrors(next);
    if (Object.keys(next).length) {
      // Move focus to the first field with a problem.
      document.getElementById(`addr-${Object.keys(next)[0]}`)?.focus();
      return;
    }

    setLoading(true);
    try {
      // `onSubmit` reaches the API, so the pending state must cover the real
      // round-trip rather than a fixed delay.
      await onSubmit({
        ...values,
        phone: toLatinDigits(values.phone).replace(/\s/g, ""),
        postalCode: toLatinDigits(values.postalCode).replace(/[\s-]/g, ""),
      });
    } catch (error) {
      setSubmitError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-busy={loading}>
      <Input
        id="addr-title"
        label="عنوان آدرس"
        required
        placeholder="خانه، محل کار، …"
        value={values.title}
        onChange={(e) => set("title", e.target.value)}
        error={errors.title}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id="addr-recipientFirstName"
          label="نام گیرنده"
          required
          autoComplete="given-name"
          value={values.recipientFirstName}
          onChange={(e) => set("recipientFirstName", e.target.value)}
          error={errors.recipientFirstName}
        />
        <Input
          id="addr-recipientLastName"
          label="نام خانوادگی گیرنده"
          required
          autoComplete="family-name"
          value={values.recipientLastName}
          onChange={(e) => set("recipientLastName", e.target.value)}
          error={errors.recipientLastName}
        />
      </div>

      <Input
        id="addr-phone"
        label="شماره موبایل گیرنده"
        required
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        dir="ltr"
        className="[&_input]:text-start"
        placeholder="09123456789"
        value={values.phone}
        onChange={(e) => set("phone", e.target.value)}
        error={errors.phone}
        hint="برای هماهنگی تحویل مرسوله استفاده می‌شود."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          id="addr-province"
          label="استان"
          required
          placeholder="انتخاب استان"
          value={values.province}
          onChange={(e) => { set("province", e.target.value); set("city", ""); }}
          error={errors.province}
          options={provinces.map((p) => ({ value: p.name, label: p.name }))}
        />
        <Select
          id="addr-city"
          label="شهر"
          required
          disabled={!values.province}
          placeholder={values.province ? "انتخاب شهر" : "ابتدا استان را انتخاب کنید"}
          value={values.city}
          onChange={(e) => set("city", e.target.value)}
          error={errors.city}
          options={cities.map((c) => ({ value: c, label: c }))}
        />
      </div>

      <Input
        id="addr-addressLine"
        label="نشانی پستی"
        required
        placeholder="خیابان، کوچه، نام ساختمان"
        value={values.addressLine}
        onChange={(e) => set("addressLine", e.target.value)}
        error={errors.addressLine}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Input
          id="addr-plaque"
          label="پلاک"
          inputMode="numeric"
          value={values.plaque}
          onChange={(e) => set("plaque", e.target.value)}
        />
        <Input
          id="addr-unit"
          label="واحد"
          inputMode="numeric"
          value={values.unit}
          onChange={(e) => set("unit", e.target.value)}
        />
        <Input
          id="addr-postalCode"
          label="کد پستی"
          required
          inputMode="numeric"
          dir="ltr"
          className="sm:col-span-1 [&_input]:text-start"
          placeholder="۱۰ رقم"
          value={values.postalCode}
          onChange={(e) => set("postalCode", e.target.value)}
          error={errors.postalCode}
        />
      </div>

      <Checkbox
        label="این آدرس را به‌عنوان آدرس پیش‌فرض ذخیره کن"
        checked={values.isDefault}
        onChange={(e) => set("isDefault", e.target.checked)}
      />

      <div className="flex flex-wrap gap-2 pt-2">

      {submitError && <Alert tone="danger" role="alert">{submitError}</Alert>}

        <Button type="submit" loading={loading} disabled={loading}>{submitLabel}</Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
            انصراف
          </Button>
        )}
      </div>
    </form>
  );
}
