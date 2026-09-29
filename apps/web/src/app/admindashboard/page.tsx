"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Flag,
  Handshake,
  LayoutDashboard,
  Loader2,
  MapPin,
  Megaphone,
  MessageSquare,
  PhilippinePeso,
  Receipt,
  RefreshCw,
  Store,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";
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
import { toast } from "sonner";

// ─── Formatting ──────────────────────────────────────────────────────────────

const BRAND = "#BE1E2D";

// Same typography the other admin pages use.
const LABEL = "text-[10px] font-black uppercase tracking-widest text-slate-400";
const NAME = "font-black text-charcoal dark:text-white uppercase tracking-tight italic";

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
        <div className="p-10 max-w-xl mx-auto text-center space-y-4">
          <AlertTriangle className="mx-auto text-primary" size={32} />
          <p className={clsx(NAME, "text-lg")}>Couldn&apos;t load the dashboard</p>
          <p className="text-sm text-slate-500">{error}</p>
          <button
            onClick={() => load(true)}
            className="px-6 py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/25 active:scale-95"
          >
            Try again
          </button>
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

  return (
    <div className="p-4 md:p-8 lg:p-10 animate-fade-in-up space-y-10 min-h-screen max-w-[1800px] mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-8 border-b border-slate-200 dark:border-white/10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/20">
            <LayoutDashboard size={12} />
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </div>
          <h1 className="text-5xl font-black text-charcoal dark:text-white tracking-tighter italic uppercase leading-none">
            Admin <span className="text-primary">Dashboard.</span>
          </h1>
          <p className="text-slate-500 font-medium max-w-2xl text-lg">
            {greeting(new Date())}, {firstName}. Here&apos;s what&apos;s happening at SR Mall today.
          </p>
        </div>

        <div className="flex items-center gap-4">
          {refreshing ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-zinc-800 rounded-full animate-pulse">
              <Loader2 size={12} className="animate-spin text-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live Sync</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-zinc-800 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Updated {updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
            </div>
          )}
          <div className="h-10 w-px bg-slate-200 dark:bg-white/10 hidden md:block mx-2" />
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh dashboard"
            className="p-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-400 hover:text-primary transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={20} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard
          label="Collected this month"
          value={pesoCompact.format(kpis.collectedThisMonth)}
          icon={<Wallet size={18} />}
          tone="emerald"
          trend={
            kpis.collectedLastMonth > 0 || kpis.collectedThisMonth > 0
              ? { value: kpis.collectedChange, label: "vs last month" }
              : undefined
          }
          sub={`Billed ${pesoCompact.format(kpis.billedThisMonth)}`}
          href="/admindashboard/tenant-monitoring"
        />
        <KpiCard
          label="Outstanding"
          value={pesoCompact.format(kpis.outstanding)}
          icon={<PhilippinePeso size={18} />}
          tone="slate"
          sub={
            kpis.unpaidInvoices > 0
              ? `${kpis.unpaidInvoices} unpaid invoice${kpis.unpaidInvoices === 1 ? "" : "s"}`
              : "All invoices paid"
          }
          href="/admindashboard/tenant-monitoring"
        />
        <KpiCard
          label="Occupancy"
          value={`${occupancyRate}%`}
          icon={<Building2 size={18} />}
          tone="blue"
          sub={`${occupancy.occupied}/${occupancy.total} units · ${occupancy.available} free`}
          href="/admindashboard/space-manager"
        />
        <KpiCard
          label="Active tenants"
          value={kpis.activeTenants.toString()}
          icon={<Store size={18} />}
          tone="amber"
          sub={
            kpis.newTenantsThisMonth > 0
              ? `+${kpis.newTenantsThisMonth} this month`
              : "No new this month"
          }
          href="/admindashboard/tenant-monitoring"
        />
        <KpiCard
          label="Registered users"
          value={kpis.totalUsers.toString()}
          icon={<Users size={18} />}
          tone="purple"
          sub={`${kpis.customerUsers} customers · +${kpis.newUsersThisMonth} new`}
          href="/admindashboard/user-management"
        />
      </section>

      {/* ── Needs attention + quick actions ────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Needs your attention" subtitle="Queues waiting on an admin decision" />
          <AttentionList attention={attention} />
        </Card>

        <Card>
          <CardHeader title="Quick actions" />
          <div className="grid grid-cols-2 gap-3">
            <QuickAction href="/admindashboard/tenant-monitoring" icon={<Receipt size={18} />} label="Post a bill" />
            <QuickAction href="/admindashboard/tenant-monitoring" icon={<UserPlus size={18} />} label="Register tenant" />
            <QuickAction href="/admindashboard/ad-scheduler" icon={<Megaphone size={18} />} label="Schedule ad" />
            <QuickAction
              href="/admindashboard/messenger-hub"
              icon={<MessageSquare size={18} />}
              label="Messages"
              badge={attention.unreadMessages}
            />
            <QuickAction href="/admindashboard/space-manager" icon={<MapPin size={18} />} label="Space manager" />
            <QuickAction href="/admindashboard/bookings" icon={<Calendar size={18} />} label="Bookings" />
          </div>
        </Card>
      </section>

      {/* ── Revenue + occupancy ────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Revenue"
            subtitle="Billed vs collected per month"
            action={
              <div className="bg-slate-50 dark:bg-white/5 p-1.5 rounded-2xl border border-slate-200 dark:border-white/5 flex gap-1">
                {([6, 12] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setRevenueRange(range)}
                    className={clsx(
                      "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95",
                      revenueRange === range
                        ? "bg-primary text-white shadow-lg shadow-primary/25"
                        : "text-slate-400 hover:text-charcoal dark:hover:text-white",
                    )}
                  >
                    {range === 6 ? "6 months" : "12 months"}
                  </button>
                ))}
              </div>
            }
          />
          <RevenueChart data={data.revenue.slice(-revenueRange)} />
        </Card>

        <Card>
          <CardHeader title="Space occupancy" subtitle={`${occupancy.total} units total`} />
          <OccupancyDonut occupancy={occupancy} rate={occupancyRate} />
        </Card>
      </section>

      {/* ── Overdue + leases ───────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Overdue payments"
            subtitle={
              data.overdueInvoiceCount > 0
                ? `${data.overdueInvoiceCount} invoice${data.overdueInvoiceCount === 1 ? "" : "s"} past due`
                : undefined
            }
            action={<CardLink href="/admindashboard/tenant-monitoring">Open ledger</CardLink>}
          />
          {data.overdueInvoices.length === 0 ? (
            <EmptyState icon={<CheckCircle2 size={22} />} text="No overdue payments. Every tenant is up to date." />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-white/5 -mx-2">
              {data.overdueInvoices.map((inv) => (
                <li key={inv.id} className="flex items-center gap-4 px-2 py-4">
                  <Avatar name={inv.shopName} src={inv.logoUrl} />
                  <div className="min-w-0 flex-1">
                    <p className={clsx(NAME, "text-sm truncate")}>{inv.shopName}</p>
                    <p className={clsx(LABEL, "mt-0.5 truncate")}>
                      {inv.unitId && inv.unitId !== "PENDING_ASSIGNMENT" ? `${inv.unitId} · ` : ""}
                      {inv.month} · #{inv.invoiceNumber}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-charcoal dark:text-white">{pesoFull.format(inv.amount)}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-red-600">
                      {inv.daysLate > 0 ? `${inv.daysLate} day${inv.daysLate === 1 ? "" : "s"} late` : "Due today"}
                    </p>
                  </div>
                  <button
                    onClick={() => setPayingInvoice(inv)}
                    className="shrink-0 hidden sm:inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                  >
                    <PhilippinePeso size={12} /> Record
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Leases ending soon"
            subtitle="Next 60 days"
            action={
              data.leasesEndingCount > data.leasesEnding.length ? (
                <span className={LABEL}>+{data.leasesEndingCount - data.leasesEnding.length} more</span>
              ) : undefined
            }
          />
          {data.leasesEnding.length === 0 ? (
            <EmptyState icon={<CalendarClock size={22} />} text="No leases end in the next 60 days." />
          ) : (
            <ul className="space-y-3">
              {data.leasesEnding.map((lease) => (
                <li key={lease.id} className="flex items-center gap-3">
                  <Avatar name={lease.shopName} src={lease.logoUrl} />
                  <div className="min-w-0 flex-1">
                    <p className={clsx(NAME, "text-sm truncate")}>{lease.shopName}</p>
                    <p className={clsx(LABEL, "mt-0.5")}>Ends {formatShortDate(lease.endDate)}</p>
                  </div>
                  <span
                    className={clsx(
                      "shrink-0 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                      lease.daysLeft <= 0
                        ? "bg-red-500/10 text-red-600 border-red-500/20"
                        : lease.daysLeft <= 30
                          ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          : "bg-slate-100 dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10",
                    )}
                  >
                    {lease.daysLeft <= 0 ? "Expired" : `${lease.daysLeft}d left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* ── Activity + floor ───────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader
            title="Recent activity"
            action={
              <button onClick={() => setShowHistory(true)} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">
                View all
              </button>
            }
          />
          {data.activity.length === 0 ? (
            <EmptyState icon={<Activity size={22} />} text="No recent activity yet." />
          ) : (
            <ul className="space-y-4">
              {data.activity.map((item: ActivityItem) => (
                <ActivityRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Floor snapshot"
            subtitle={occupancy.total > data.floor.length ? `First ${data.floor.length} of ${occupancy.total} units` : undefined}
            action={<CardLink href="/admindashboard/space-manager">Space manager</CardLink>}
          />
          {data.floor.length === 0 ? (
            <EmptyState
              icon={<MapPin size={22} />}
              text="No units yet. Add units in the Space Manager to see them here."
            />
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {data.floor.map((slot) => (
                  <FloorTile key={slot.id} slot={slot} />
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-6 text-[10px] font-black uppercase tracking-widest text-slate-500">
                {Object.entries(UNIT_STATUS).map(([key, s]) => (
                  <span key={key} className="flex items-center gap-1.5">
                    <span className={clsx("w-2 h-2 rounded-full", s.dot)} /> {s.label}
                  </span>
                ))}
              </div>
            </>
          )}
        </Card>
      </section>

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

      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} />}
    </div>
  );
}

// ─── Building blocks ─────────────────────────────────────────────────────────

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={clsx(
        "bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-[2.5rem] p-6 md:p-8 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-6">
      <div className="space-y-1">
        <h2 className="text-xl font-black text-charcoal dark:text-white uppercase tracking-tight italic leading-none">
          {title}
        </h2>
        {subtitle && <p className={LABEL}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="shrink-0 text-[10px] font-black uppercase tracking-widest text-primary hover:underline flex items-center gap-1">
      {children} <ArrowRight size={12} />
    </Link>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 gap-3 text-slate-300 dark:text-slate-600">
      {icon}
      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs max-w-xs leading-relaxed">{text}</p>
    </div>
  );
}

function Avatar({ name, src }: { name: string; src?: string | null }) {
  return (
    <div className="w-12 h-12 shrink-0 rounded-[1rem] bg-primary/10 overflow-hidden flex items-center justify-center text-base font-black italic text-primary">
      {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : name.charAt(0).toUpperCase()}
    </div>
  );
}

const TONES = {
  emerald: "bg-emerald-500/10 text-emerald-600",
  red: "bg-red-500/10 text-red-600",
  blue: "bg-blue-500/10 text-blue-600",
  amber: "bg-amber-500/10 text-amber-600",
  slate: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  purple: "bg-purple-500/10 text-purple-600",
} as const;

function KpiCard({
  label,
  value,
  icon,
  tone,
  sub,
  trend,
  href,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: keyof typeof TONES;
  sub?: string;
  trend?: { value: number; label: string };
  href: string;
}) {
  const up = (trend?.value ?? 0) >= 0;
  return (
    <Link
      href={href}
      title={sub ? `${label}: ${value} · ${sub}` : `${label}: ${value}`}
      className="group min-w-0 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-[2rem] p-5 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all"
    >
      <span
        className={clsx(
          "w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform",
          TONES[tone],
        )}
      >
        {icon}
      </span>
      <p className={clsx(LABEL, "mt-4 truncate")}>{label}</p>
      <p className="mt-1 text-3xl font-black tracking-tighter text-charcoal dark:text-white truncate">{value}</p>
      <div className="mt-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider min-w-0">
        {trend && (
          <span
            className={clsx(
              "inline-flex items-center gap-0.5 font-black shrink-0",
              up ? "text-emerald-600" : "text-red-600",
            )}
          >
            {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(trend.value)}%
          </span>
        )}
        {sub && <span className="text-slate-400 truncate">{sub}</span>}
      </div>
    </Link>
  );
}

function AttentionList({ attention }: { attention: AdminDashboardData["attention"] }) {
  const rows = [
    {
      key: "applications",
      count: attention.merchantApplications,
      icon: <Handshake size={16} />,
      label: "Merchant applications",
      detail: "Waiting for approval",
      href: "/admindashboard/bookings?tab=merchant",
    },
    {
      key: "reservations",
      count: attention.reservations,
      icon: <MapPin size={16} />,
      label: "Space reservations",
      detail:
        attention.urgentReservations > 0
          ? `${attention.urgentReservations} expire within 6 hours`
          : "Released automatically after 24 hours",
      urgent: attention.urgentReservations > 0,
      href: "/admindashboard/bookings?tab=reservation",
    },
    {
      key: "slips",
      count: attention.depositSlips,
      icon: <FileCheck2 size={16} />,
      label: "Deposit slips to verify",
      detail: "Tenants uploaded proof of payment",
      href: "/admindashboard/tenant-monitoring",
    },
    {
      key: "events",
      count: attention.eventInquiries,
      icon: <Calendar size={16} />,
      label: "Event inquiries",
      detail: "Booking requests from customers",
      href: "/admindashboard/bookings?tab=event",
    },
    {
      key: "promos",
      count: attention.promos,
      icon: <Megaphone size={16} />,
      label: "Promos to review",
      detail: "Tenant promotions awaiting approval",
      href: "/admindashboard/ad-scheduler",
    },
    {
      key: "reviews",
      count: attention.flaggedReviews,
      icon: <Flag size={16} />,
      label: "Flagged reviews",
      detail: "Marked as possible spam",
      href: "/admindashboard/user-management",
    },
    {
      key: "messages",
      count: attention.unreadMessages,
      icon: <MessageSquare size={16} />,
      label: "Unread messages",
      detail: "From tenants and customers",
      href: "/admindashboard/messenger-hub",
    },
  ].filter((r) => r.count > 0);

  if (rows.length === 0) {
    return <EmptyState icon={<ClipboardCheck size={22} />} text="All caught up. Nothing is waiting on you." />;
  }

  return (
    <ul className="divide-y divide-slate-100 dark:divide-white/5 -mx-2">
      {rows.map((row) => (
        <li key={row.key}>
          <Link
            href={row.href}
            className="flex items-center gap-4 px-3 py-4 rounded-2xl hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors group"
          >
            <span
              className={clsx(
                "w-12 h-12 shrink-0 rounded-[1rem] flex items-center justify-center group-hover:scale-110 transition-transform",
                row.urgent ? TONES.red : "bg-primary/10 text-primary",
              )}
            >
              {row.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className={clsx(NAME, "text-sm")}>{row.label}</p>
              <p
                className={clsx(
                  "mt-0.5 text-[10px] font-bold uppercase tracking-widest truncate",
                  row.urgent ? "text-red-600" : "text-slate-400",
                )}
              >
                {row.detail}
              </p>
            </div>
            <span
              className={clsx(
                "min-w-[2.25rem] px-2.5 py-1 rounded-full text-center text-[11px] font-black border",
                row.urgent
                  ? "bg-red-500 text-white border-red-500"
                  : "bg-primary/10 text-primary border-primary/20",
              )}
            >
              {row.count}
            </span>
            <ArrowRight size={16} className="text-slate-300 group-hover:text-primary transition-colors" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function QuickAction({
  href,
  icon,
  label,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col items-start gap-3 p-4 rounded-2xl bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:border-primary/30 hover:bg-primary/5 transition-all active:scale-95"
    >
      <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
        {icon}
      </span>
      <span className="text-[10px] font-black uppercase tracking-widest text-charcoal dark:text-white">{label}</span>
      {badge ? (
        <span className="absolute top-2 right-2 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

function RevenueChart({ data }: { data: AdminDashboardData["revenue"] }) {
  const hasData = data.some((d) => d.billed > 0 || d.collected > 0);
  if (!hasData) {
    return <EmptyState icon={<Wallet size={22} />} text="No invoices in this period yet." />;
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
              borderRadius: 12,
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

const UNIT_STATUS: Record<string, { label: string; color: string; dot: string; tile: string }> = {
  OCCUPIED: {
    label: "Occupied",
    color: BRAND,
    dot: "bg-[#BE1E2D]",
    tile: "border-[#BE1E2D]/30 bg-[#BE1E2D]/5 text-[#BE1E2D]",
  },
  RESERVED: {
    label: "Reserved",
    color: "#f59e0b",
    dot: "bg-amber-500",
    tile: "border-amber-500/30 bg-amber-500/5 text-amber-600",
  },
  AVAILABLE: {
    label: "Available",
    color: "#10b981",
    dot: "bg-emerald-500",
    tile: "border-emerald-500/30 bg-emerald-500/5 text-emerald-600",
  },
  MAINTENANCE: {
    label: "Maintenance",
    color: "#94a3b8",
    dot: "bg-slate-400",
    tile: "border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-500",
  },
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
    return <EmptyState icon={<Building2 size={22} />} text="No units have been set up yet." />;
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
              contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-4xl font-black text-charcoal dark:text-white leading-none">{rate}%</p>
          <p className={clsx(LABEL, "mt-1")}>Occupied</p>
        </div>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-2">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name}
            </span>
            <span className="text-sm font-black text-charcoal dark:text-white tabular-nums">{s.value}</span>
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
      className={clsx("rounded-2xl border-2 p-4 transition-all hover:shadow-md hover:-translate-y-0.5 min-w-0", s.tile)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-black italic uppercase truncate">{slot.unitId}</span>
        <span className={clsx("w-2 h-2 rounded-full shrink-0", s.dot)} />
      </div>
      <p
        className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 truncate"
        title={slot.shopName || undefined}
      >
        {slot.status === "OCCUPIED"
          ? slot.shopName || "Occupied"
          : slot.status === "AVAILABLE"
            ? `${pesoCompact.format(slot.baseRent || 0)}/mo`
            : s.label}
      </p>
    </Link>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const content = (
    <div className="flex gap-3">
      <span
        className={clsx(
          "mt-1.5 w-2 h-2 rounded-full shrink-0",
          item.urgent ? "bg-primary" : "bg-slate-300 dark:bg-zinc-600",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className={clsx(NAME, "text-sm truncate")}>{item.title}</p>
          <span className={clsx(LABEL, "shrink-0")}>{item.time}</span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-medium line-clamp-1">{item.description}</p>
      </div>
    </div>
  );
  return (
    <li>
      {item.targetUrl ? (
        <Link href={item.targetUrl} className="block rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 -mx-2 px-2 py-1 transition-colors">
          {content}
        </Link>
      ) : (
        content
      )}
    </li>
  );
}

function HistoryModal({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<ActivityItem[] | null>(null);

  useEffect(() => {
    getRecentActivity(50)
      .then((res) => setItems(res.success && res.data ? res.data : []))
      .catch(() => setItems([]));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        className="relative w-full max-w-2xl max-h-[85vh] bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl flex flex-col border border-slate-200 dark:border-white/10 overflow-hidden animate-fade-in-up"
      >
        <div className="flex items-center justify-between p-6 md:p-8 border-b border-slate-100 dark:border-white/5">
          <div className="space-y-1">
            <h2 id="history-title" className="text-2xl font-black text-charcoal dark:text-white uppercase tracking-tight italic">
              Activity <span className="text-primary">History.</span>
            </h2>
            <p className={LABEL}>Last 50 events</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-lg text-slate-400 hover:text-charcoal dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          {items === null ? (
            <div className="flex justify-center py-16">
              <RefreshCw className="animate-spin text-primary" size={24} />
            </div>
          ) : items.length === 0 ? (
            <EmptyState icon={<Activity size={22} />} text="No activity recorded yet." />
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <ActivityRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
