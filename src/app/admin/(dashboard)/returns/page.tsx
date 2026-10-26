import { redirect } from "next/navigation";

export default function AdminReturnsPage() {
  redirect("/admin/orders");
}
