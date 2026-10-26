import { ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { updateContactMessage } from "@/server/services/submissions";
import { requestUpdateSchema } from "@/server/schemas/admin";

/** PATCH /api/v1/admin/contact/[id] */

type Params = { id: string };

export const PATCH = adminRoute<Params>(async (request, { params, audit }) => {
  const input = await adminBody(request, requestUpdateSchema);
  const result = await updateContactMessage(params.id, input);

  await audit({
    action: "contact.update",
    entityType: "contact_message",
    entityId: params.id,
    summary: `پیام ${result.number} به‌روزرسانی شد`,
    meta: { status: input.status },
  });

  return ok({ message: result });
});
