import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdmin } from "@/server/lib/session";

/**
 * The authoritative admin gate.
 *
 * `middleware.ts` only checks that a cookie exists — it runs on the Edge, where
 * the database is out of reach. This layout is where the token is actually
 * validated, so a forged or expired cookie never renders an admin screen. Every
 * `/api/v1/admin/*` handler repeats the check independently: hiding UI is never
 * the control.
 */
export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");

  return <AdminShell admin={{ name: admin.name, email: admin.email }}>{children}</AdminShell>;
}

// The admin panel is per-session and must never be statically cached.
export const dynamic = "force-dynamic";
