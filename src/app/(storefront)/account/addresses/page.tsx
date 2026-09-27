"use client";

import { useState } from "react";
import { MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Overlay";
import { EmptyState } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { AddressForm } from "@/components/account/AddressForm";
import { useAuth } from "@/store/AuthProvider";
import { formatPhone, toPersianDigits } from "@/lib/format";
import type { Address } from "@/types";

export default function AddressesPage() {
  const { user, addresses, addAddress, updateAddress, removeAddress, setDefaultAddress } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Address | null>(null);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-fg sm:text-2xl">آدرس‌های من</h1>
          <p className="mt-1.5 text-sm text-fg-muted">آدرس‌هایی که هنگام ثبت سفارش می‌توانید انتخاب کنید.</p>
        </div>
        <Button onClick={() => setEditing("new")} icon={<Plus className="size-4" aria-hidden />}>
          افزودن آدرس
        </Button>
      </header>

      {addresses.length === 0 ? (
        <EmptyState
          icon={<MapPin className="size-7" aria-hidden />}
          title="هنوز آدرسی ثبت نکرده‌اید"
          description="برای اینکه سفارش‌هایتان سریع‌تر ثبت شود، یک آدرس تحویل اضافه کنید."
          action={<Button onClick={() => setEditing("new")}>افزودن اولین آدرس</Button>}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id}>
              <Card className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="flex items-center gap-2 font-semibold text-fg">
                    {address.title}
                    {address.isDefault && <Badge tone="brand" size="sm">پیش‌فرض</Badge>}
                  </h2>
                </div>

                <div className="mt-2 flex-1 text-sm leading-7 text-fg-muted">
                  <p>{address.province}، {address.city}، {address.addressLine}</p>
                  <p className="tnum">
                    {address.plaque && `پلاک ${address.plaque}`}
                    {address.unit && `، واحد ${address.unit}`}
                  </p>
                  <p className="tnum">کد پستی: {toPersianDigits(address.postalCode)}</p>
                  <p className="tnum mt-1.5 border-t border-border pt-1.5">
                    {address.recipientFirstName} {address.recipientLastName} — {formatPhone(address.phone)}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(address)} icon={<Pencil className="size-4" aria-hidden />}>
                    ویرایش
                  </Button>
                  {!address.isDefault && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setDefaultAddress(address.id); toast({ tone: "success", title: "آدرس پیش‌فرض تغییر کرد" }); }}
                        icon={<Star className="size-4" aria-hidden />}
                      >
                        پیش‌فرض کن
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDelete(address)}
                        icon={<Trash2 className="size-4" aria-hidden />}
                        className="text-fg-muted hover:text-danger"
                      >
                        حذف
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "افزودن آدرس جدید" : "ویرایش آدرس"}
        size="lg"
      >
        {editing && (
          <AddressForm
            initial={
              editing === "new"
                ? {
                    recipientFirstName: user?.firstName,
                    recipientLastName: user?.lastName,
                    phone: user?.phone,
                    isDefault: addresses.length === 0,
                  }
                : editing
            }
            submitLabel={editing === "new" ? "ثبت آدرس" : "ذخیره تغییرات"}
            onCancel={() => setEditing(null)}
            onSubmit={(data) => {
              if (editing === "new") {
                addAddress(data);
                toast({ tone: "success", title: "آدرس جدید ثبت شد" });
              } else {
                updateAddress(editing.id, data);
                toast({ tone: "success", title: "آدرس به‌روزرسانی شد" });
              }
              setEditing(null);
            }}
          />
        )}
      </Modal>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="حذف آدرس"
        description={confirmDelete ? `آدرس «${confirmDelete.title}» حذف شود؟ این کار قابل بازگشت نیست.` : ""}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>انصراف</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirmDelete) {
                  removeAddress(confirmDelete.id);
                  toast({ tone: "success", title: "آدرس حذف شد" });
                }
                setConfirmDelete(null);
              }}
            >
              حذف آدرس
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-7 text-fg-muted">
          سفارش‌های قبلی که با این آدرس ثبت شده‌اند تغییری نمی‌کنند.
        </p>
      </Modal>
    </div>
  );
}
