"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Checkbox";
import { Modal } from "@/components/ui/Overlay";
import { Alert } from "@/components/ui/Feedback";
import { ThemeSegmented } from "@/components/layout/ThemeToggle";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/store/AuthProvider";
import { formatPhone } from "@/lib/format";

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, updateUser, logout } = useAuth();

  const [sms, setSms] = useState(user?.smsNotifications ?? true);
  const [promoSms, setPromoSms] = useState(false);
  const [emailNews, setEmailNews] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-fg sm:text-2xl">تنظیمات</h1>
        <p className="mt-1.5 text-sm text-fg-muted">اطلاع‌رسانی‌ها، ظاهر سایت و مدیریت حساب.</p>
      </header>

      <Card>
        <h2 className="mb-4 font-bold text-fg">اطلاع‌رسانی</h2>
        <div className="divide-y divide-border">
          <div className="py-3 first:pt-0">
            <Switch
              checked={sms}
              onChange={(value) => {
                setSms(value);
                updateUser({ smsNotifications: value });
                toast({ tone: "info", title: value ? "پیامک وضعیت سفارش فعال شد" : "پیامک وضعیت سفارش غیرفعال شد" });
              }}
              label="پیامک وضعیت سفارش"
              description={`تغییر وضعیت سفارش‌ها به شماره ${user ? formatPhone(user.phone) : ""} پیامک می‌شود.`}
            />
          </div>
          <div className="py-3">
            <Switch
              checked={promoSms}
              onChange={setPromoSms}
              label="پیامک تخفیف‌ها و کمپین‌ها"
              description="حراج‌های فصلی و کدهای تخفیف ویژه."
            />
          </div>
          <div className="py-3 last:pb-0">
            <Switch
              checked={emailNews}
              onChange={setEmailNews}
              label="خبرنامه ایمیلی"
              description={user?.email ? `به ${user.email} ارسال می‌شود.` : "برای فعال‌سازی، ابتدا ایمیل خود را در اطلاعات حساب ثبت کنید."}
              disabled={!user?.email}
            />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 font-bold text-fg">حالت نمایش</h2>
        <p className="mb-4 text-sm text-fg-muted">
          حالت «سیستم» از تنظیمات دستگاه شما پیروی می‌کند.
        </p>
        <ThemeSegmented />
      </Card>

      <Card>
        <h2 className="mb-4 font-bold text-fg">حساب کاربری</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => { logout(); toast({ tone: "info", title: "از حساب خود خارج شدید" }); router.push("/"); }}
            icon={<LogOut className="size-4" aria-hidden />}
          >
            خروج از حساب
          </Button>
          {/* Destructive action kept visually and spatially separate. */}
          <Button
            variant="ghost"
            onClick={() => setDeleteOpen(true)}
            icon={<Trash2 className="size-4" aria-hidden />}
            className="text-danger hover:bg-danger-soft"
          >
            حذف حساب کاربری
          </Button>
        </div>
      </Card>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="حذف حساب کاربری"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>انصراف</Button>
            <Button
              variant="danger"
              onClick={() => {
                setDeleteOpen(false);
                toast({
                  tone: "info",
                  title: "درخواست حذف حساب ثبت شد",
                  description: "کارشناس پشتیبانی برای تأیید نهایی با شما تماس می‌گیرد.",
                });
              }}
            >
              ثبت درخواست حذف
            </Button>
          </div>
        }
      >
        <Alert tone="danger" title="این کار قابل بازگشت نیست">
          با حذف حساب، دسترسی شما به سابقه سفارش‌ها، آدرس‌ها و فاکتورها از بین می‌رود.
          سفارش‌های در جریان تا تحویل نهایی پیگیری می‌شوند.
        </Alert>
      </Modal>
    </div>
  );
}
