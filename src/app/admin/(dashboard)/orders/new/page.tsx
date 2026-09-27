import { AdminPageHeader } from "@/components/admin/AdminShell";
import { ManualOrderForm } from "@/components/admin/ManualOrderForm";
import { listShippingMethods } from "@/server/services/shipping";

/**
 * Admin → Orders → Add manual order.
 *
 * For orders taken by phone, Instagram, WhatsApp or in person. The result is an
 * ordinary order — same tables, same lists, same reports — marked
 * `source = "manual"` so reporting can tell them apart later.
 */

export const dynamic = "force-dynamic";

export default async function NewManualOrderPage() {
  const shippingMethods = await listShippingMethods({ activeOnly: true });

  return (
    <>
      <AdminPageHeader
        title="ثبت سفارش دستی"
        description="برای سفارش‌هایی که تلفنی، اینستاگرام، واتس‌اپ یا حضوری دریافت شده‌اند."
      />
      <ManualOrderForm shippingMethods={shippingMethods} />
    </>
  );
}
