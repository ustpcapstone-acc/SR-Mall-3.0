"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, Loader, cn } from "@cloudflare/kumo";
import { ArrowClockwise, CaretRight } from "@phosphor-icons/react";
import { AdminDialog, AdminPage, EmptyNote, Panel, Person, Stat } from "@/components/admin/page-kit";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/app/providers";
import {
  getAdminDashboardAction,
  getRecentActivity,
  type AdminDashboardData,
} from "@/app/actions/dashboard";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { RecordCashPaymentModal } from "@/components/admin/record-cash-payment-modal";
import { RecordPaymentGuide } from "@/components/admin/record-payment-guide";
import { toast } from "sonner";

// ─── Formatting ──────────────────────────────────────────────────────────────

const BRAND = "#BE1E2D";

const pesoCompact = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  notation: "compact",
  maximumFractionDigits: 1,
});
const pesoFull = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const formatShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function greeting(date: Date) {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

type ActivityItem = AdminDashboardData["activity"][number];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [revenueRange, setRevenueRange] = useState<6 | 12>(6);
  const [payingInvoice, setPayingInvoice] = useState<
    AdminDashboardData["overdueInvoices"][number] | null
  >(null);
  const [showHistory, setShowHistory] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(
    async (manual = false) => {
      if (inFlight.current) return;
      inFlight.current = true;
      if (manual) setRefreshing(true);
      try {
        const res = await getAdminDashboardAction(user?.id);
        if (res.success) {
          setData(res.data);
          setError(null);
        } else {
          setError(res.error);
        }
      } catch (err: any) {
        setError(err?.message || "Failed to load dashboard");
      } finally {
        inFlight.current = false;
        setRefreshing(false);
      }
    },
    [user?.id],
  );

  // First load, then a quiet refresh every 60s while the tab is visible.
  useEffect(() => {
    void load();
    const interval = setInterval(() => {
      if (!document.hidden) void load();
    }, 60000);
    const onVisible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  if (!data) {
    if (error) {
      return (
        <div className="mx-auto max-w-xl p-4 sm:p-8">
          <Panel flush>
            <EmptyNote
              title="Couldn't load the dashboard"
              action={
                <Button variant="primary" onClick={() => load(true)}>
                  Try again
                </Button>
              }
            >
              {error}
            </EmptyNote>
          </Panel>
        </div>
      );
    }
    return <DashboardSkeleton />;
  }

  const { kpis, occupancy, attention } = data;
  const occupancyRate =
    occupancy.total > 0 ? Math.round((occupancy.occupied / occupancy.total) * 100) : 0;
  const updatedAt = new Date(data.generatedAt);
  const firstName = (user?.name || "Administrator").split(" ")[0];
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const change = kpis.collectedLastMonthToDate > 0 || kpis.collectedThisMonth > 0 ? kpis.collectedChange : null;

  return (
    <AdminPage
      title="Admin Dashboard"
      description={`${greeting(new Date())}, ${firstName}. ${today}.`}
      actions={
        <>
          <p className="mr-1 text-sm text-kumo-subtle" aria-live="polite">
            {refreshing
              ? "Updating..."
              : `Updated ${updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
          </p>
          <RecordPaymentGuide />
          <Button variant="secondary" icon={<ArrowClockwise />} loading={refreshing} onClick={() => load(true)}>
            Refresh
          </Button>
        </>
      }
    >
      {/* Needs attention comes first: it is the work waiting for today. */}
      <Panel title="Needs your attention" description="Queues waiting on an admin decision" flush>
        <AttentionList attention={attention} />
      </Panel>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat
          label="Collected this month"
          value={pesoCompact.format(kpis.collectedThisMonth)}
          hint={
            <>
              {change !== null && (
                <span className={cn("block font-medium", change >= 0 ? "text-kumo-success" : "text-kumo-danger")}>
                  {change >= 0 ? "Up" : "Down"} {Math.abs(change)}% vs same day last month
                </span>
              )}
              Billed {pesoCompact.format(kpis.billedThisMonth)}
            </>
          }
          href="/admindashboard/tenant-monitoring"
        />
        <Stat
          label="Outstanding"
          value={pesoCompact.format(kpis.outstanding)}
          hint={
            kpis.unpaidInvoices > 0
              ? `${kpis.unpaidInvoices} unpaid invoice${kpis.unpaidInvoices === 1 ? "" : "s"}`
              : "All invoices paid"
          }
          href="/admindashboard/tenant-monitoring"
        />
        <Stat
          label="Occupancy"
          value={`${occupancyRate}%`}
          hint={`${occupancy.occupied} of ${occupancy.total} units, ${occupancy.available} free`}
          href="/admindashboard/space-manager"
        />
        <Stat
          label="Active tenants"
          value={kpis.activeTenants}
          hint={kpis.newTenantsThisMonth > 0 ? `${kpis.newTenantsThisMonth} new this month` : "No new this month"}
          href="/admindashboard/tenant-monitoring"
        />
        <Stat
          label="Registered users"
          value={kpis.totalUsers}
          hint={`${kpis.customerUsers} customers, ${kpis.newUsersThisMonth} new`}
          href="/admindashboard/user-management"
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Revenue"
          description="Billed vs collected per month"
          actions={
            <div role="group" aria-label="Months shown" className="flex gap-1">
              {([6, 12] as const).map((range) => (
                <Button
                  key={range}
                  size="sm"
                  variant={revenueRange === range ? "primary" : "secondary"}
                  aria-pressed={revenueRange === range}
                  onClick={() => setRevenueRange(range)}
                >
                  {range} months
                </Button>
              ))}
            </div>
          }
        >
          <RevenueChart data={data.revenue.slice(-revenueRange)} />
        </Panel>

        <Panel title="Space occupancy" description={`${occupancy.total} units total`}>
          <OccupancyDonut occupancy={occupancy} rate={occupancyRate} />
        </Panel>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          flush
          title="Overdue payments"
          description={
            data.overdueInvoiceCount > 0
              ? `${data.overdueInvoiceCount} invoice${data.overdueInvoiceCount === 1 ? "" : "s"} past due`
              : undefined
          }
          actions={<CardLink href="/admindashboard/tenant-monitoring">Open ledger</CardLink>}
        >
          {data.overdueInvoices.length === 0 ? (
            <EmptyNote title="No overdue payments">Every tenant is up to date.</EmptyNote>
          ) : (
            <ul className="divide-y divide-kumo-line">
              {data.overdueInvoices.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center gap-3 p-4 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <Person
                      square
                      name={inv.shopName}
                      image={inv.logoUrl}
                      detail={`${inv.unitId && inv.unitId !== "PENDING_ASSIGNMENT" ? `${inv.unitId}, ` : ""}${inv.month}, #${inv.invoiceNumber.replace(/^#/, "")}`}
                    />
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-kumo-default">{pesoFull.format(inv.amount)}</p>
                    <p className="text-sm font-medium text-kumo-danger">
                      {inv.daysLate > 0 ? `${inv.daysLate} day${inv.daysLate === 1 ? "" : "s"} late` : "Due today"}
                    </p>
                  </div>
                  <Button size="sm" variant="primary" onClick={() => setPayingInvoice(inv)}>
                    Record
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          flush
          title="Leases ending soon"
          description="Next 60 days"
          actions={
            data.leasesEndingCount > data.leasesEnding.length ? (
              <span className="text-sm text-kumo-subtle">{data.leasesEndingCount - data.leasesEnding.length} more</span>
            ) : undefined
          }
        >
          {data.leasesEnding.length === 0 ? (
            <EmptyNote title="No leases end in the next 60 days" />
          ) : (
            <ul className="divide-y divide-kumo-line">
              {data.leasesEnding.map((lease) => (
                <li key={lease.id} className="flex items-center justify-between gap-3 p-4">
                  <Person square name={lease.shopName} image={lease.logoUrl} detail={`Ends ${formatShortDate(lease.endDate)}`} />
                  <span
                    className={cn(
                      "shrink-0 text-sm font-medium",
                      lease.daysLeft <= 0 ? "text-kumo-danger" : lease.daysLeft <= 30 ? "text-kumo-warning" : "text-kumo-subtle",
                    )}
                  >
                    {lease.daysLeft <= 0 ? "Expired" : `${lease.daysLeft} days left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Panel
          title="Recent activity"
          flush
          actions={
            <Button size="sm" variant="ghost" onClick={() => setShowHistory(true)}>
              View all
            </Button>
          }
        >
          {data.activity.length === 0 ? (
            <EmptyNote title="No recent activity yet" />
          ) : (
            <ul className="divide-y divide-kumo-line">
              {data.activity.map((item: ActivityItem) => (
                <ActivityRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          className="lg:col-span-2"
          title="Floor snapshot"
          description={occupancy.total > data.floor.length ? `First ${data.floor.length} of ${occupancy.total} units` : undefined}
          actions={<CardLink href="/admindashboard/space-manager">Space manager</CardLink>}
        >
          {data.floor.length === 0 ? (
            <EmptyNote title="No units yet">Add units in the Space Manager to see them here.</EmptyNote>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {data.floor.map((slot) => (
                  <FloorTile key={slot.id} slot={slot} />
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-kumo-subtle">
                {Object.entries(UNIT_STATUS).map(([key, s]) => (
                  <span key={key} className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} /> {s.label}
                  </span>
                ))}
              </div>
            </>
          )}
        </Panel>
      </div>

      {payingInvoice && (
        <RecordCashPaymentModal
          invoice={payingInvoice}
          tenantName={payingInvoice.shopName}
          onClose={() => setPayingInvoice(null)}
          onRecorded={() => {
            setPayingInvoice(null);
            toast.success("Payment recorded");
            void load();
          }}
        />
      )}

      <HistoryDialog open={showHistory} onClose={() => setShowHistory(false)} />
    </AdminPage>
  );
}

// ─── Building blocks ─────────────────────────────────────────────────────────

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="shrink-0 text-sm font-medium text-kumo-link hover:underline">
      {children}
    </Link>
  );
}

function AttentionList({ attention }: { attention: AdminDashboardData["attention"] }) {
  const rows = [
    {
      key: "reservations",
      count: attention.reservations,
      label: "Space reservations",
      detail:
        attention.urgentReservations > 0
          ? `${attention.urgentReservations} expire${attention.urgentReservations === 1 ? "s" : ""} within 6 hours`
          : "Released automatically after 2 days",
      urgent: attention.urgentReservations > 0,
      href: "/admindashboard/bookings?tab=reservation",
    },
    {
      key: "slips",
      count: attention.depositSlips,
      label: "Deposit slips to verify",
      detail: "Tenants uploaded proof of payment",
      href: "/admindashboard/tenant-monitoring?payment=verifying",
    },
    {
      key: "events",
      count: attention.eventInquiries,
      label: "Event inquiries",
      detail: "Booking requests from customers",
      href: "/admindashboard/bookings?tab=event",
    },
    {
      key: "promos",
      count: attention.promos,
      label: "Promos to review",
      detail: "Tenant promotions awaiting approval",
      href: "/admindashboard/ad-scheduler",
    },
    {
      key: "reviews",
      count: attention.flaggedReviews,
      label: "Flagged reviews",
      detail: "Marked as possible spam",
      href: "/admindashboard/user-management?tab=feedback",
    },
    {
      key: "messages",
      count: attention.unreadMessages,
      label: "Unread messages",
      detail: "From tenants and customers",
      href: "/admindashboard/messenger-hub",
    },
  ].filter((r) => r.count > 0);

  if (rows.length === 0) {
    return <EmptyNote title="All caught up">Nothing is waiting on you.</EmptyNote>;
  }

  return (
    <ul className="grid gap-px bg-kumo-line sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => (
        <li key={row.key} className="bg-kumo-base">
          <Link href={row.href} className="flex h-full items-center gap-4 p-4 hover:bg-kumo-tint sm:px-5">
            <span
              className={cn("w-10 shrink-0 text-2xl font-semibold tabular-nums", row.urgent ? "text-kumo-danger" : "text-kumo-brand")}
            >
              {row.count}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-kumo-default">{row.label}</span>
              <span className={cn("block text-sm", row.urgent ? "text-kumo-danger" : "text-kumo-subtle")}>{row.detail}</span>
            </span>
            <CaretRight size={16} aria-hidden className="shrink-0 text-kumo-subtle" />
          </Link>
        </li>
      ))}
      {/* Fill the last row so no grey cells show through. */}
      {rows.length % 2 === 1 && <li aria-hidden className="hidden bg-kumo-base sm:block xl:hidden" />}
      {Array.from({ length: (3 - (rows.length % 3)) % 3 }, (_, i) => (
        <li key={`gap-${i}`} aria-hidden className="hidden bg-kumo-base xl:block" />
      ))}
    </ul>
  );
}

function RevenueChart({ data }: { data: AdminDashboardData["revenue"] }) {
  const hasData = data.some((d) => d.billed > 0 || d.collected > 0);
  if (!hasData) {
    return <EmptyNote title="No invoices in this period yet" />;
  }
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="collectedFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={BRAND} stopOpacity={0.25} />
              <stop offset="95%" stopColor={BRAND} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.6} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} dy={8} />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={56}
            tick={{ fontSize: 12, fill: "#94a3b8" }}
            tickFormatter={(v) => pesoCompact.format(Number(v))}
          />
          <Tooltip
            formatter={(value: any, name: any) => [pesoFull.format(Number(value || 0)), name]}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              boxShadow: "0 8px 20px -6px rgba(0,0,0,0.15)",
              fontSize: 12,
            }}
          />
          <Legend verticalAlign="top" align="right" height={28} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="billed"
            name="Billed"
            stroke="#94a3b8"
            strokeWidth={2}
            strokeDasharray="5 4"
            fill="none"
          />
          <Area
            type="monotone"
            dataKey="collected"
            name="Collected"
            stroke={BRAND}
            strokeWidth={2.5}
            fill="url(#collectedFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const UNIT_STATUS: Record<string, { label: string; color: string }> = {
  OCCUPIED: { label: "Occupied", color: BRAND },
  RESERVED: { label: "Reserved", color: "#f59e0b" },
  AVAILABLE: { label: "Available", color: "#10b981" },
  MAINTENANCE: { label: "Maintenance", color: "#94a3b8" },
};

function OccupancyDonut({
  occupancy,
  rate,
}: {
  occupancy: AdminDashboardData["occupancy"];
  rate: number;
}) {
  const slices = [
    { key: "OCCUPIED", value: occupancy.occupied },
    { key: "RESERVED", value: occupancy.reserved },
    { key: "AVAILABLE", value: occupancy.available },
    { key: "MAINTENANCE", value: occupancy.maintenance },
  ].map((s) => ({ ...s, name: UNIT_STATUS[s.key].label, color: UNIT_STATUS[s.key].color }));

  if (occupancy.total === 0) {
    return <EmptyNote title="No units have been set up yet" />;
  }

  return (
    <>
      <div className="relative h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices.filter((s) => s.value > 0)}
              dataKey="value"
              innerRadius={62}
              outerRadius={88}
              paddingAngle={3}
              stroke="none"
            >
              {slices
                .filter((s) => s.value > 0)
                .map((s) => (
                  <Cell key={s.key} fill={s.color} />
                ))}
            </Pie>
            <Tooltip
              formatter={(value: any, name: any) => [`${value} unit${Number(value) === 1 ? "" : "s"}`, name]}
              contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-3xl font-semibold leading-none tabular-nums text-kumo-default">{rate}%</p>
          <p className="mt-1 text-sm text-kumo-subtle">Occupied</p>
        </div>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm text-kumo-subtle">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name}
            </span>
            <span className="text-sm font-semibold tabular-nums text-kumo-default">{s.value}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function FloorTile({ slot }: { slot: AdminDashboardData["floor"][number] }) {
  const s = UNIT_STATUS[slot.status] || UNIT_STATUS.MAINTENANCE;
  return (
    <Link
      href="/admindashboard/space-manager"
      className="min-w-0 rounded-lg border border-kumo-line border-l-4 p-3 hover:bg-kumo-tint"
      style={{ borderLeftColor: s.color }}
    >
      <span className="block truncate text-sm font-semibold text-kumo-default">{slot.unitId}</span>
      <span className="block truncate text-sm text-kumo-subtle" title={slot.shopName || undefined}>
        {slot.status === "OCCUPIED"
          ? slot.shopName || "Occupied"
          : slot.status === "AVAILABLE"
            ? `${pesoCompact.format(slot.baseRent || 0)} a month`
            : s.label}
      </span>
    </Link>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const content = (
    <div className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className={cn("truncate text-sm font-medium", item.urgent ? "text-kumo-brand" : "text-kumo-default")}>{item.title}</p>
        <span className="shrink-0 text-xs text-kumo-subtle">{item.time}</span>
      </div>
      <p className="line-clamp-1 text-sm text-kumo-subtle">{item.description}</p>
    </div>
  );
  return (
    <li>
      {item.targetUrl ? (
        <Link href={item.targetUrl} className="block hover:bg-kumo-tint">
          {content}
        </Link>
      ) : (
        content
      )}
    </li>
  );
}

function HistoryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [items, setItems] = useState<ActivityItem[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setItems(null);
    getRecentActivity(50)
      .then((res) => setItems(res.success && res.data ? res.data : []))
      .catch(() => setItems([]));
  }, [open]);

  return (
    <AdminDialog open={open} onClose={onClose} size="lg" title="Activity history" description="Last 50 events">
      {items === null ? (
        <div className="flex justify-center py-16">
          <Loader />
        </div>
      ) : items.length === 0 ? (
        <EmptyNote title="No activity recorded yet" />
      ) : (
        <ul className="divide-y divide-kumo-line rounded-lg border border-kumo-line">
          {items.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </AdminDialog>
  );
}
