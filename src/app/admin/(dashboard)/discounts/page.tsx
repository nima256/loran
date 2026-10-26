import { AdminPageHeader } from "@/components/admin/AdminShell";
import { CampaignManager, CouponManager } from "@/components/admin/DiscountManager";
import { StatTile } from "@/components/admin/Charts";
import { listCampaigns, listCoupons } from "@/server/services/admin-discounts";
import { getCouponPerformance } from "@/server/services/analytics";
import { prisma } from "@/server/lib/prisma";
import { formatCompactPrice, toPersianDigits } from "@/lib/format";

/** Admin → Discounts: coupons and campaigns. */

export const dynamic = "force-dynamic";

export default async function AdminDiscountsPage() {
  const [coupons, campaigns, performance, products] = await Promise.all([
    listCoupons({ page: 1, pageSize: 100 }),
    listCampaigns({ page: 1, pageSize: 50 }),
    getCouponPerformance(50),
    prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const totalRedemptions = performance.reduce((n, c) => n + c.usageCount, 0);
  const totalDiscount = performance.reduce((n, c) => n + c.totalDiscount, 0);
  const activeCoupons = coupons.items.filter((c) => c.active && !c.archived && !c.expired).length;

  return (
    <>
      <AdminPageHeader
        title="تخفیف و کمپین"
        description="کدهای تخفیف و کمپین‌های فروش."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatTile
          label="کدهای فعال"
          value={toPersianDigits(activeCoupons)}
          hint={`از ${toPersianDigits(coupons.total)} کد`}
        />
        <StatTile
          label="دفعات استفاده"
          value={toPersianDigits(totalRedemptions)}
          hint="در همه سفارش‌های پرداخت‌شده"
        />
        <StatTile
          label="مجموع تخفیف داده‌شده"
          value={formatCompactPrice(totalDiscount)}
          hint="از محل کدهای تخفیف"
        />
      </div>

      <div className="space-y-4">
        <CouponManager coupons={coupons.items} />
        <CampaignManager campaigns={campaigns.items} products={products} />
      </div>
    </>
  );
}
