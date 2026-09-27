import { z } from "zod";
import { handler, ok, readJson, requestContext } from "@/server/lib/http";
import { emailSchema } from "@/server/lib/validation";
import { loginAdmin } from "@/server/services/admin-auth";

/** POST /api/v1/admin/auth/login */

const bodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: "رمز عبور را وارد کنید." }).max(200),
});

export const POST = handler(async (request) => {
  const { email, password } = await readJson(request, bodySchema);
  const { ip, userAgent } = requestContext(request);
  const admin = await loginAdmin({ email, password, ip, userAgent });
  return ok({ admin });
});
