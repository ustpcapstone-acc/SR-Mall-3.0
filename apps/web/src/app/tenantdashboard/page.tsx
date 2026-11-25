"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Loader, cn } from "@cloudflare/kumo";
import { Megaphone, Receipt, ChatCircle, Storefront, Star } from "@phosphor-icons/react";
import { useAuth } from "@/app/providers";
import { getApprovedReviewsAction } from "@/app/actions/review";
import { getStorefrontAction } from "@/app/actions/tenant";
import { getTenantPaymentScheduleAction } from "@/app/actions/finance";
import { AdminPage, EmptyNote, Panel, Stat, StatRow } from "@/components/admin/page-kit";

const LINK = "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium";
const LINK_PRIMARY = cn(LINK, "bg-kumo-brand text-white hover:bg-kumo-brand-hover");
const LINK_QUIET = cn(LINK, "border border-kumo-line text-kumo-default hover:bg-kumo-tint");

const SECTIONS = [
  { href: "/tenantdashboard/digital-storefront", label: "Storefront", help: "Shop details and products", icon: Storefront },
  { href: "/tenantdashboard/ad-promo-manager", label: "Ads & Promos", help: "Submit a promotion", icon: Megaphone },
  { href: "/tenantdashboard/customer-messenger", label: "Messages", help: "Reply to shoppers", icon: ChatCircle },
  { href: "/tenantdashboard/payments", label: "Payments", help: "Bills and proof of payment", icon: Receipt },
];

const PAYMENT_STATUS = {
  Paid: { label: "Paid up to date", tone: "success", dateLabel: "Next billing date", amountLabel: "Last amount paid" },
  Pending: { label: "Payment due", tone: "warning", dateLabel: "Due date", amountLabel: "Amount due" },
  Overdue: { label: "Overdue", tone: "danger", dateLabel: "Was due", amountLabel: "Amount due" },
  Reviewing: { label: "Proof being checked", tone: "default", dateLabel: "Due date", amountLabel: "Amount due" },
} as const;

const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;

export default function TenantDashboard() {
  const { user } = useAuth();
  const [liveReviews, setLiveReviews] = useState<any[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [shopName, setShopName] = useState("");
  const [unitId, setUnitId] = useState("");
  const [paymentSchedule, setPaymentSchedule] = useState<{
    nextPaymentDate: string | Date | null;
    paymentMonth: string;
    paymentAmount: number;
    paymentStatus: "Paid" | "Pending" | "Overdue" | "Reviewing";
    lastPaymentDate: string | Date | null;
    invoiceNumber?: string | null;
    totalUnpaidBalance?: number;
    paidInvoicesCount?: number;
    totalInvoices?: number;
  } | null>(null);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);

  const formatDate = (val: string | Date | null | undefined): string => {
    if (!val) return "None recorded";
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return String(val);
    }
  };

  useEffect(() => {
    async function loadData() {
      if (!user?.id) {
        setIsLoading(false);
        setIsLoadingSchedule(false);
        return;
      }
      try {
        const [tenantRes, scheduleRes] = await Promise.all([
          getStorefrontAction(user.id),
          getTenantPaymentScheduleAction(user.id).catch(() => ({
            success: false,
            data: null,
          })),
        ]);

        let tId = undefined;
        if (tenantRes.success && tenantRes.data) {
          tId = tenantRes.data.id;
          setShopName(tenantRes.data.shop_name);
          setUnitId(tenantRes.data.unit_id);
        }

        if (scheduleRes?.success && scheduleRes?.data) {
          setPaymentSchedule(scheduleRes.data);
        }

        // No shop id → no reviews. Calling without one would return the
        // general mall reviews and show them as this shop's.
        const result = tId
          ? await getApprovedReviewsAction(tId)
          : { success: true as const, data: [] as any[] };
        if (result.success && result.data) {
          setLiveReviews(result.data);
          const total = result.data.reduce(
            (acc: number, r: any) => acc + r.rating,
            0,
          );
          setAvgRating(
            result.data.length > 0
              ? Number((total / result.data.length).toFixed(1))
              : 0,
          );
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
        setIsLoadingSchedule(false);
      }
    }
    loadData();
  }, [user?.id]);

  const loading = (value: React.ReactNode) => (isLoading ? "..." : value);
  const scheduled = (value: React.ReactNode) => (isLoadingSchedule ? "..." : value);
  const pay = paymentSchedule;
  const status = pay ? PAYMENT_STATUS[pay.paymentStatus] ?? PAYMENT_STATUS.Pending : null;
  const hasUnit = !!unitId && !/PENDING|UNASSIGNED/.test(unitId);
  const unitText = hasUnit ? `Unit ${unitId}` : "No unit assigned yet";
  const unpaid = pay?.totalUnpaidBalance ?? 0;

  return (
    <AdminPage
      title="Overview"
      description={isLoading ? "Loading your shop..." : `${shopName || "Your shop"}, ${unitText}`}
      actions={
        <Link href="/tenantdashboard/digital-storefront" className={LINK_QUIET}>
          <Storefront size={16} aria-hidden /> Edit storefront
        </Link>
      }
    >
      <StatRow>
        <Stat
          label={status?.amountLabel ?? "Amount due"}
          value={scheduled(pay ? peso(pay.paymentAmount || 0) : "Not set")}
          hint={status?.label}
          tone={status?.tone}
          href="/tenantdashboard/payments"
        />
        <Stat
          label={status?.dateLabel ?? "Due date"}
          value={scheduled(formatDate(pay?.nextPaymentDate))}
          hint={pay?.paymentMonth}
          href="/tenantdashboard/payments"
        />
        <Stat
          label="Unpaid balance"
          value={scheduled(pay ? peso(unpaid) : "Not set")}
          hint={pay ? `${pay.paidInvoicesCount ?? 0} of ${pay.totalInvoices ?? 0} bills paid` : undefined}
          tone={unpaid > 0 ? "danger" : "default"}
          href="/tenantdashboard/payments"
        />
        <Stat
          label="Shop rating"
          value={loading(liveReviews.length ? avgRating.toFixed(1) : "No rating")}
          hint={isLoading ? undefined : `${liveReviews.length} review${liveReviews.length === 1 ? "" : "s"}`}
          href="/tenantdashboard/feedback-reviews"
        />
      </StatRow>

      <nav aria-label="Shop sections" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SECTIONS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-w-0 items-center gap-3 rounded-xl border border-kumo-line bg-kumo-base p-4 hover:border-kumo-brand hover:bg-kumo-tint"
          >
            <item.icon size={24} aria-hidden className="shrink-0 text-kumo-brand" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-kumo-default">{item.label}</span>
              <span className="hidden text-sm text-kumo-subtle sm:block">{item.help}</span>
            </span>
          </Link>
        ))}
      </nav>

      <div className="grid items-start gap-6 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          title="Payments"
          description="Your rent bill and payment record"
          actions={
            <>
              <Link href="/tenantdashboard/payments" className={LINK_QUIET}>
                Lease and billing
              </Link>
              <Link href="/tenantdashboard/payments" className={LINK_PRIMARY}>
                Submit proof of payment
              </Link>
            </>
          }
        >
          {isLoadingSchedule ? (
            <div className="flex justify-center py-8">
              <Loader />
            </div>
          ) : !pay ? (
            <EmptyNote title="No payment details yet">Your bills appear here once the mall office sets up your lease.</EmptyNote>
          ) : (
            <dl className="divide-y divide-kumo-line">
              <Row label="Status">
                <span
                  className={cn(
                    "font-semibold",
                    status?.tone === "success" && "text-kumo-success",
                    status?.tone === "warning" && "text-kumo-warning",
                    status?.tone === "danger" && "text-kumo-danger",
                  )}
                >
                  {status?.label}
                </span>
              </Row>
              <Row label="Billing month">{pay.paymentMonth || "Current month"}</Row>
              <Row label="Bill">{pay.invoiceNumber ? `Invoice ${pay.invoiceNumber}` : "Monthly rent"}</Row>
              <Row label={status?.amountLabel ?? "Amount"}>{peso(pay.paymentAmount || 0)}</Row>
              <Row label={status?.dateLabel ?? "Due date"}>{formatDate(pay.nextPaymentDate)}</Row>
              <Row label="Last payment">{formatDate(pay.lastPaymentDate)}</Row>
            </dl>
          )}
        </Panel>

        <Panel
          className="lg:col-span-2"
          flush
          title="Recent reviews"
          actions={
            <Link href="/tenantdashboard/feedback-reviews" className={LINK_QUIET}>
              All reviews
            </Link>
          }
        >
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader />
            </div>
          ) : liveReviews.length === 0 ? (
            <EmptyNote title="No reviews yet">Reviews appear here when shoppers rate your shop.</EmptyNote>
          ) : (
            <ul className="divide-y divide-kumo-line">
              {liveReviews.slice(0, 5).map((r, i) => (
                <li key={r.id ?? i} className="px-4 py-3 sm:px-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-kumo-default">{r.user?.name?.split(" ")[0] || "Shopper"}</p>
                    <span className="flex shrink-0 items-center gap-1 text-sm text-kumo-default" aria-label={`${r.rating} out of 5 stars`}>
                      <Star size={14} weight="fill" className="text-amber-500" aria-hidden />
                      {r.rating}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm text-kumo-subtle">{r.comment || "No comment."}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AdminPage>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <dt className="text-sm text-kumo-subtle">{label}</dt>
      <dd className="text-right text-sm font-medium text-kumo-default">{children}</dd>
    </div>
  );
}
