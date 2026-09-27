import { z } from "zod";
import { ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { prisma } from "@/server/lib/prisma";
import { optionalText } from "@/server/lib/validation";

/** PATCH /api/v1/admin/orders/[id]/note — internal note, never shown to the customer. */

type Params = { id: string };

const bodySchema = z.object({ adminNote: optionalText(2000) });

export const PATCH = adminRoute<Params>(async (request, { params, audit }) => {
  const { adminNote } = await adminBody(request, bodySchema);
  const order = await prisma.order.update({
    where: { id: params.id },
    data: { adminNote: adminNote ?? null },
    select: { number: true, adminNote: true },
  });

  await audit({
    action: "order.note",
    entityType: "order",
    entityId: params.id,
    summary: `یادداشت داخلی سفارش ${order.number} به‌روزرسانی شد`,
  });

  return ok({ adminNote: order.adminNote });
});
