"use client";

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  MousePointerClick,
  AlertTriangle,
  Building2,
  Bell,
  Ban,
  ArrowRight,
  MessageSquare,
  MapPin,
  RefreshCw,
  PhilippinePeso,
  Users,
  Store,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  Activity,
  Calendar,
  ChevronRight,
  Zap,
  Shield,
  Eye,
  MoreHorizontal,
  ArrowUpRight,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { useAuth } from "@/app/providers";
import { getAreaSlots } from "@/app/actions/space-slot";
import { getAllStorefrontsAction } from "@/app/actions/tenant";
import { getUserCountAction } from "@/app/actions/auth";
import {
  fixUserRolesAction,
  checkUserRolesAction,
} from "@/app/actions/fix-roles";
import { getAllInvoices } from "@/app/actions/finance";
import { getRecentActivity } from "@/app/actions/dashboard";

// --- Types ---
interface DashboardStats {
  totalUsers: number;
  totalRevenue: number;
  collectedRevenue: number;
  pendingRevenue: number;
  totalTenants: number;
  totalSpaces: number;
  occupiedSpaces: number;
  availableSpaces: number;
  pendingSpaces: number;
  adEngagement: number;
  urgentAlerts: number;
  paidCount: number;
  overdueCount: number;
  pendingCount: number;
  expiringContracts: number;
}

interface RecentActivity {
  id: string;
  type: "booking" | "blacklist" | "support" | "payment" | "contract" | "promo" | "review";
  title: string;
  description: string;
  time: string;
  urgent?: boolean;
  status?: string;
  targetUrl?: string;
  fullDate?: string;
}

interface ExpiringContract {
  id: string;
  name: string;
  unit: string;
  endDate: string;
  daysLeft: number;
  urgent: boolean;
}

// --- Mock Data Generators ---
const REVENUE_DATA = [
  { name: "Jan", value: 420000 },
  { name: "Feb", value: 380000 },
  { name: "Mar", value: 450000 },
  { name: "Apr", value: 480000 },
  { name: "May", value: 510000 },
  { name: "Jun", value: 520000 },
];

const CATEGORY_DATA = [
  { name: "Fashion", value: 45 },
  { name: "Food", value: 32 },
  { name: "Gadgets", value: 24 },
  { name: "Services", value: 18 },
  { name: "Wellness", value: 12 },
];

const COLORS = ["#ef4444", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6"];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [fixingRoles, setFixingRoles] = useState(false);
  const [roleStats, setRoleStats] = useState({ userRole: 0, customerRole: 0 });
  const [revenueData, setRevenueData] = useState<{name: string; value: number}[]>(REVENUE_DATA);
  const [categoryData, setCategoryData] = useState<{name: string; value: number}[]>(CATEGORY_DATA);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalRevenue: 0,
    collectedRevenue: 0,
    pendingRevenue: 0,
    totalTenants: 0,
    totalSpaces: 0,
    occupiedSpaces: 0,
    availableSpaces: 0,
    pendingSpaces: 0,
    adEngagement: 12450,
    urgentAlerts: 0,
    paidCount: 0,
    overdueCount: 0,
    pendingCount: 0,
    expiringContracts: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [expiringContracts, setExpiringContracts] = useState<
    ExpiringContract[]
  >([]);
  const [floorSlots, setFloorSlots] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [fullHistory, setFullHistory] = useState<RecentActivity[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [revenueRange, setRevenueRange] = useState<"6M" | "1Y" | "ALL">("6M");
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [revenueGrowth, setRevenueGrowth] = useState<number>(18);

  const updateRevenueChart = (invoicesList: any[], range: "6M" | "1Y" | "ALL") => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const d = new Date();
    d.setDate(1);

    const paidInvoices = invoicesList.filter((inv: any) => inv.status === "PAID");
    let buckets: { name: string; year: number; value: number }[] = [];

    if (range === "6M") {
      for (let i = 5; i >= 0; i--) {
        const date = new Date(d.getTime());
        date.setMonth(d.getMonth() - i);
        buckets.push({
          name: months[date.getMonth()],
          year: date.getFullYear(),
          value: 0,
        });
      }
    } else if (range === "1Y") {
      for (let i = 11; i >= 0; i--) {
        const date = new Date(d.getTime());
        date.setMonth(d.getMonth() - i);
        buckets.push({
          name: months[date.getMonth()],
          year: date.getFullYear(),
          value: 0,
        });
      }
    } else {
      let earliestDate = new Date();
      paidInvoices.forEach((inv: any) => {
        const invDate = new Date(inv.createdAt);
        if (invDate < earliestDate) earliestDate = invDate;
      });
      earliestDate.setDate(1);

      const monthDiff = Math.max(
        6,
        (d.getFullYear() - earliestDate.getFullYear()) * 12 +
          (d.getMonth() - earliestDate.getMonth()) +
          1
      );
      const displayMonths = Math.min(monthDiff, 24);

      for (let i = displayMonths - 1; i >= 0; i--) {
        const date = new Date(d.getTime());
        date.setMonth(d.getMonth() - i);
        buckets.push({
          name: `${months[date.getMonth()]} '${String(date.getFullYear()).slice(-2)}`,
          year: date.getFullYear(),
          value: 0,
        });
      }
    }

    paidInvoices.forEach((inv: any) => {
      const invDate = new Date(inv.createdAt);
      const monthStr = months[invDate.getMonth()];
      const year = invDate.getFullYear();

      const target = buckets.find((b) => {
        if (range === "ALL") {
          return b.name.startsWith(monthStr) && b.year === year;
        }
        return b.name === monthStr && b.year === year;
      });

      if (target) {
        target.value += Number(inv.amount || 0);
      }
    });

    setRevenueData(buckets.map((b) => ({ name: b.name, value: b.value })));

    if (buckets.length >= 2) {
      const latest = buckets[buckets.length - 1]?.value || 0;
      const prior = buckets[buckets.length - 2]?.value || 0;
      if (prior > 0) {
        setRevenueGrowth(Math.round(((latest - prior) / prior) * 100));
      } else if (latest > 0) {
        setRevenueGrowth(100);
      } else {
        setRevenueGrowth(0);
      }
    } else {
      setRevenueGrowth(0);
    }
  };

  const openHistoryModal = async () => {
    setShowHistoryModal(true);
    setLoadingHistory(true);
    try {
      const activityResult = await getRecentActivity(50);
      if (activityResult.success && activityResult.data) {
        setFullHistory(activityResult.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch spaces data
      const slotsResult = await getAreaSlots();
      const spaces =
        slotsResult.success && slotsResult.data ? slotsResult.data : [];

      // Fetch tenants data
      const tenantsResult = await getAllStorefrontsAction();
      const tenants =
        tenantsResult.success && tenantsResult.data ? tenantsResult.data : [];

      // Fetch users data
      const usersResult = await getUserCountAction();
      const totalUsers =
        usersResult.success && usersResult.data ? usersResult.data : 0;

      // Calculate stats
      const occupied = spaces.filter(
        (s: any) => s.status === "OCCUPIED",
      ).length;
      const available = spaces.filter(
        (s: any) => s.status === "AVAILABLE",
      ).length;
      const pending = spaces.filter(
        (s: any) => s.status === "MAINTENANCE",
      ).length;

      // Calculate sector performance
      const categoryCounts: Record<string, number> = {};
      spaces.forEach((s: any) => {
        if (s.status === "OCCUPIED") {
          const cat = s.category || "Unknown";
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        }
      });
      const newCategoryData = Object.entries(categoryCounts)
        .map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
      
      setCategoryData(newCategoryData.length > 0 ? newCategoryData : CATEGORY_DATA.map(c => ({...c, value: 0})));

      // Fetch invoices data (matching Tenant Monitoring Collected calculation)
      const invoices = await getAllInvoices();
      setAllInvoices(invoices);
      updateRevenueChart(invoices, revenueRange);

      const collectedRevenue = invoices
        .filter((inv: any) => inv.status === "PAID")
        .reduce((sum: number, inv: any) => sum + Number(inv.amount || 0), 0);

      const pendingRevenue = invoices
        .filter((inv: any) => inv.status === "PENDING" || inv.status === "REVIEWING")
        .reduce((sum: number, inv: any) => sum + Number(inv.amount || 0), 0);

      const totalRevenue = collectedRevenue;

      // Payment status per tenant
      let paidCount = 0;
      let overdueCount = 0;
      let pendingCount = 0;

      const tenantPaymentStatus: Record<string, "OVERDUE" | "PENDING" | "PAID"> = {};
      
      invoices.forEach((inv: any) => {
        if (!inv.tenantId) return;
        const currentStatus = tenantPaymentStatus[inv.tenantId] || "PAID";
        if (inv.status === "OVERDUE") {
          tenantPaymentStatus[inv.tenantId] = "OVERDUE";
        } else if (inv.status === "PENDING" && currentStatus !== "OVERDUE") {
          tenantPaymentStatus[inv.tenantId] = "PENDING";
        } else if (inv.status === "PAID" && !tenantPaymentStatus[inv.tenantId]) {
          tenantPaymentStatus[inv.tenantId] = "PAID";
        }
      });

      tenants.forEach((t: any) => {
         if (!tenantPaymentStatus[t.id]) tenantPaymentStatus[t.id] = "PAID";
      });

      Object.values(tenantPaymentStatus).forEach(status => {
        if (status === "OVERDUE") overdueCount++;
        else if (status === "PENDING") pendingCount++;
        else if (status === "PAID") paidCount++;
      });

      // Fetch recent activity
      const activityResult = await getRecentActivity();
      const activity: RecentActivity[] = activityResult.success && activityResult.data ? activityResult.data : [];

      // Generate expiring contracts
      const contracts: ExpiringContract[] = tenants
        .slice(0, 5)
        .map((tenant: any, index: number) => ({
          id: tenant.id,
          name: tenant.shop_name,
          unit: tenant.unit_id,
          endDate: new Date(
            Date.now() + (index + 1) * 15 * 24 * 60 * 60 * 1000,
          ).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          daysLeft: (index + 1) * 15,
          urgent: index < 2,
        }));

      // Prepare floor slots
      const displaySlots = spaces
        .slice(0, 10)
        .map((space: any, index: number) => ({
          id: space.unit_id || `L1-${String(index + 1).padStart(2, "0")}`,
          status: space.status?.toLowerCase() || "available",
          label:
            space.status === "OCCUPIED"
              ? tenants.find((t: any) => t.unit_id === space.unit_id)
                ?.shop_name || "Occupied"
              : undefined,
          price:
            space.status === "AVAILABLE"
              ? `₱${Math.round((space.sqm_size * 150) / 1000)}k`
              : undefined,
        }));

      setStats({
        totalUsers: totalUsers || 0,
        totalRevenue: totalRevenue,
        collectedRevenue: collectedRevenue,
        pendingRevenue: pendingRevenue,
        totalTenants: tenants.length,
        totalSpaces: spaces.length,
        occupiedSpaces: occupied,
        availableSpaces: available,
        pendingSpaces: pending,
        adEngagement: 12450 + Math.floor(Math.random() * 1000),
        urgentAlerts:
          contracts.filter((c) => c.urgent).length +
          activity.filter((a) => a.urgent).length,
        paidCount: paidCount,
        overdueCount: overdueCount,
        pendingCount: pendingCount,
        expiringContracts:
          contracts.filter((c) => c.daysLeft <= 30).length,
      });

      setRecentActivity(activity);
      setExpiringContracts(contracts);
      setFloorSlots(
        displaySlots.length > 0
          ? displaySlots
          : [
            { id: "L1-01", status: "occupied", label: "Coffee Culture" },
            { id: "L1-02", status: "available", price: "₱15k" },
            { id: "L1-03", status: "occupied", label: "Gadget Sphere" },
            { id: "L1-04", status: "available", price: "₱12k" },
            { id: "L1-05", status: "pending", label: "Under Review" },
            { id: "L1-06", status: "occupied", label: "Prism Fitness" },
            { id: "L1-07", status: "occupied", label: "Velvet & Vine" },
            { id: "L1-08", status: "available", price: "₱18k" },
            { id: "L1-09", status: "pending", label: "Under Review" },
            { id: "L1-10", status: "occupied", label: "Urban Threads" },
          ],
      );

      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDashboardData();
    checkRoles();
  }, []);

  const checkRoles = async () => {
    const res = await checkUserRolesAction();
    if (res.success && res.data) {
      setRoleStats(res.data);
    }
  };

  const handleFixRoles = async () => {
    setFixingRoles(true);
    const res = await fixUserRolesAction();
    if (res.success) {
      alert(res.message);
      checkRoles();
    } else {
      alert("Error: " + res.error);
    }
    setFixingRoles(false);
  };

  const occupancyPieData = [
    { name: "Occupied", value: stats.occupiedSpaces, color: "#ef4444" }, // Using primary-like red
    { name: "Available", value: stats.availableSpaces, color: "#10b981" },
    { name: "Maintenance", value: stats.pendingSpaces, color: "#f59e0b" },
  ];

  return (
    <div className="p-4 md:p-8 lg:p-10 min-h-screen bg-slate-50/50 dark:bg-transparent space-y-8 animate-fade-in-up">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-500/5 blur-[100px] rounded-full" />
      </div>

      {/* Header Section */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-4 bg-primary rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary/80">
              Live Overview
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-charcoal dark:text-white tracking-tight leading-none italic">
            Admin <span className="text-primary">Dashboard</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm md:text-base">
            Morning,{" "}
            <span className="text-charcoal dark:text-slate-200 font-bold">
              {user?.name || "Administrator"}
            </span>
            . Here's your mall's performance overview.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Fix User Roles Button */}
          {roleStats.userRole > 0 && (
            <button
              onClick={handleFixRoles}
              disabled={fixingRoles}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-widest rounded-2xl transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-2"
              title={`${roleStats.userRole} users have incorrect 'USER' role`}
            >
              {fixingRoles ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Shield size={16} />
              )}
              Fix {roleStats.userRole} User Roles
            </button>
          )}
          <div className="text-right px-4 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              Last Updated
            </p>
            <p className="text-xs font-black text-charcoal dark:text-white flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {lastUpdated.toLocaleTimeString()}
            </p>
          </div>
          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="p-3 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 rounded-2xl border border-slate-200 dark:border-white/10 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      {/* KPI Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <StatCard
          title="Total Revenue"
          value={`\u20b1${stats.totalRevenue.toLocaleString()}`}
          trend="Collected"
          subtext={`Pending: \u20b1${stats.pendingRevenue.toLocaleString()}`}
          icon={<PhilippinePeso size={20} />}
          color="primary"
          chart={true}
        />
        <StatCard
          title="Occupancy Rate"
          value={`${stats.totalSpaces > 0 ? Math.round((stats.occupiedSpaces / stats.totalSpaces) * 100) : 0}%`}
          trend={`${stats.occupiedSpaces}/${stats.totalSpaces} Units`}
          icon={<Building2 size={20} />}
          color="emerald"
        />
        <StatCard
          title="Available Spaces"
          value={stats.availableSpaces.toString()}
          trend="Ready to Lease"
          icon={<MapPin size={20} />}
          color="blue"
        />
        <StatCard
          title="Registered Tenants"
          value={stats.totalTenants.toString()}
          trend="Active Stores"
          icon={<Store size={20} />}
          color="amber"
        />
        <StatCard
          title="Total Registered Users"
          value={stats.totalUsers.toString()}
          trend="Live Accounts"
          icon={<Users size={20} />}
          color="purple"
        />
      </div>

      {/* Main Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Growth Chart */}
        <div className="lg:col-span-2 glass-premium bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-6 md:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden relative group">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div className="space-y-1">
              <h2 className="text-lg font-black text-charcoal dark:text-white tracking-tight">
                Revenue Analytics
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                {revenueRange === "6M" ? "Past 6 Months" : revenueRange === "1Y" ? "Past 12 Months" : "All Time Performance"}{" "}
                <span className={clsx("font-black", revenueGrowth >= 0 ? "text-emerald-500" : "text-red-500")}>
                  {revenueGrowth >= 0 ? `+${revenueGrowth}%` : `${revenueGrowth}%`} {revenueRange === "1Y" ? "YoY" : "MoM"}
                </span>
              </p>
            </div>
            <div className="flex p-1 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/5">
              <button
                onClick={() => {
                  setRevenueRange("6M");
                  updateRevenueChart(allInvoices, "6M");
                }}
                className={clsx(
                  "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                  revenueRange === "6M"
                    ? "bg-white dark:bg-white/10 text-charcoal dark:text-white shadow-sm"
                    : "text-slate-400 hover:text-charcoal dark:hover:text-white"
                )}
              >
                6M
              </button>
              <button
                onClick={() => {
                  setRevenueRange("1Y");
                  updateRevenueChart(allInvoices, "1Y");
                }}
                className={clsx(
                  "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                  revenueRange === "1Y"
                    ? "bg-white dark:bg-white/10 text-charcoal dark:text-white shadow-sm"
                    : "text-slate-400 hover:text-charcoal dark:hover:text-white"
                )}
              >
                1Y
              </button>
              <button
                onClick={() => {
                  setRevenueRange("ALL");
                  updateRevenueChart(allInvoices, "ALL");
                }}
                className={clsx(
                  "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                  revenueRange === "ALL"
                    ? "bg-white dark:bg-white/10 text-charcoal dark:text-white shadow-sm"
                    : "text-slate-400 hover:text-charcoal dark:hover:text-white"
                )}
              >
                All
              </button>
            </div>
          </div>

          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={revenueData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                  className="dark:stroke-white/5"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fontWeight: 600, fill: "#94a3b8" }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fontWeight: 600, fill: "#94a3b8" }}
                  tickFormatter={(value) => `\u20b1${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
                />
                <Tooltip
                  formatter={(value: any) => [`\u20b1${Number(value || 0).toLocaleString()}`, "Revenue"]}
                  contentStyle={{
                    backgroundColor: "#fff",
                    borderRadius: "16px",
                    border: "none",
                    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
                    padding: "12px",
                  }}
                  itemStyle={{ color: "#ef4444", fontWeight: 800 }}
                  labelStyle={{
                    fontWeight: 800,
                    marginBottom: "4px",
                    color: "#1e293b",
                  }}
                  cursor={{
                    stroke: "#ef4444",
                    strokeWidth: 2,
                    strokeDasharray: "5 5",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#ef4444"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Capacity Utilization (Donut) */}
        <div className="glass-premium bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-6 md:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col items-center">
          <div className="w-full mb-6">
            <h2 className="text-lg font-black text-charcoal dark:text-white tracking-tight">
              Space Utilization
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Real-time Occupancy
            </p>
          </div>

          <div className="relative w-full h-[280px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={occupancyPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {occupancyPieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      stroke="none"
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-4xl font-black text-charcoal dark:text-white leading-none">
                {stats.totalSpaces > 0 ? Math.round((stats.occupiedSpaces / stats.totalSpaces) * 100) : 0}%
              </p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                Occupied
              </p>
            </div>
          </div>

          <div className="w-full space-y-3 mt-4">
            {occupancyPieData.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {item.name}
                  </span>
                </div>
                <span className="text-sm font-black text-charcoal dark:text-white tabular-nums">
                  {item.value} Units
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Financial & Sector Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Sector Performance */}
        <div className="glass-premium bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-6 md:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col justify-between hover:shadow-2xl transition-all duration-300">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="space-y-1">
                <h2 className="text-lg font-black text-charcoal dark:text-white tracking-tight">
                  Sector Performance
                </h2>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Tenant Count By Industry
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 flex items-center justify-center text-slate-400 dark:text-slate-500">
                <Zap size={18} />
              </div>
            </div>

            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                    className="dark:stroke-white/5"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fontWeight: 700, fill: "#94a3b8" }}
                    dy={5}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.04)" }}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
                      backgroundColor: "#fff",
                    }}
                    formatter={(value: any) => [`${value} Tenants`, "Count"]}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {categoryData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
              Top Industry
            </span>
            <span className="font-black text-charcoal dark:text-white">
              {categoryData[0]?.name || "Retail"} ({categoryData[0]?.value || 0} Units)
            </span>
          </div>
        </div>

        {/* Collection Status */}
        <div className="glass-premium bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-6 md:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col justify-between hover:shadow-2xl transition-all duration-300">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="space-y-1">
                <h2 className="text-lg font-black text-charcoal dark:text-white tracking-tight">
                  Collection Status
                </h2>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Revenue Realization
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 flex items-center justify-center text-slate-400 dark:text-slate-500">
                <Wallet size={18} />
              </div>
            </div>

            {/* Hero Collection Metrics */}
            <div className="p-4 bg-slate-50/50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Collection Rate</span>
                <span className="text-xs font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                  {stats.collectedRevenue + stats.pendingRevenue > 0
                    ? Math.round((stats.collectedRevenue / (stats.collectedRevenue + stats.pendingRevenue)) * 100)
                    : 0}% Realized
                </span>
              </div>
              <p className="text-3xl font-black text-charcoal dark:text-white tracking-tight">
                ₱{stats.collectedRevenue.toLocaleString()}
              </p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                of ₱{(stats.collectedRevenue + stats.pendingRevenue).toLocaleString()} Billed Rent
              </p>

              {/* Modern Progress Bar */}
              <div className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      stats.collectedRevenue + stats.pendingRevenue > 0
                        ? Math.min(100, Math.round((stats.collectedRevenue / (stats.collectedRevenue + stats.pendingRevenue)) * 100))
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Financial breakdown pills */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-emerald-50/70 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/20">
                <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Paid In</p>
                <p className="text-base font-black text-emerald-700 dark:text-emerald-300">₱{stats.collectedRevenue.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-amber-50/70 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/20">
                <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">Outstanding</p>
                <p className="text-base font-black text-amber-700 dark:text-amber-300">₱{stats.pendingRevenue.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
              Tenant Monitoring
            </span>
            <Link
              href="/admindashboard/tenant-monitoring"
              className="font-black text-primary hover:underline flex items-center gap-1"
            >
              View Ledger <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {/* Tenant Rent Dues */}
        <div className="glass-premium bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-6 md:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col justify-between hover:shadow-2xl transition-all duration-300">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="space-y-1">
                <h2 className="text-lg font-black text-charcoal dark:text-white tracking-tight">
                  Tenant Rent Dues
                </h2>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Payment Standing
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 flex items-center justify-center text-slate-400 dark:text-slate-500">
                <CreditCard size={18} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center p-3.5 bg-red-50/70 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/20 transition-all hover:bg-red-50 dark:hover:bg-red-900/20">
                <div>
                  <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-widest">Overdue</p>
                  <p className="text-xl font-black text-red-700 dark:text-red-300">{stats.overdueCount} Tenants</p>
                </div>
                <AlertTriangle className="text-red-500 opacity-80" size={20} />
              </div>

              <div className="flex justify-between items-center p-3.5 bg-amber-50/70 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/20 transition-all hover:bg-amber-50 dark:hover:bg-amber-900/20">
                <div>
                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">Need to Pay</p>
                  <p className="text-xl font-black text-amber-700 dark:text-amber-300">{stats.pendingCount} Tenants</p>
                </div>
                <Clock className="text-amber-500 opacity-80" size={20} />
              </div>

              <div className="flex justify-between items-center p-3.5 bg-emerald-50/70 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/20 transition-all hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
                <div>
                  <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Paid Up</p>
                  <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">{stats.paidCount} Tenants</p>
                </div>
                <CheckCircle className="text-emerald-500 opacity-80" size={20} />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
              Accounts Monitored
            </span>
            <span className="font-black text-charcoal dark:text-white">
              {stats.totalTenants} Total Tenants
            </span>
          </div>
        </div>
      </div>

      {/* Operations & Leasing Oversight */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expiring Contracts */}
        <div className="glass-premium bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-6 md:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col justify-between hover:shadow-2xl transition-all duration-300">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="space-y-1">
                <h2 className="text-lg font-black text-charcoal dark:text-white tracking-tight">
                  Expiring Contracts
                </h2>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Lease Renewal Radar
                </p>
              </div>
              <Link
                href="/admindashboard/tenant-monitoring"
                className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-primary hover:border-primary/30 transition-all group"
                title="View All Leases"
              >
                <ArrowUpRight size={18} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            </div>

            <div className="space-y-3">
              {expiringContracts.slice(0, 4).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3.5 bg-slate-50/50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 hover:border-slate-200 dark:hover:border-white/10 transition-all group"
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={clsx(
                        "w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-sm transition-transform group-hover:scale-105",
                        c.urgent
                          ? "bg-primary text-white"
                          : "bg-white dark:bg-zinc-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10",
                      )}
                    >
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-black text-charcoal dark:text-white leading-snug">
                        {c.name}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Unit {c.unit}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={clsx(
                        "text-[10px] font-black uppercase px-2 py-0.5 rounded-full inline-block mb-0.5",
                        c.urgent
                          ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-slate-300"
                      )}
                    >
                      {c.daysLeft}d left
                    </span>
                    <p className="text-[10px] font-medium text-slate-400">
                      {c.endDate}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
              Contracts Due in 30 Days
            </span>
            <span className="font-black text-charcoal dark:text-white">
              {stats.expiringContracts} Leases
            </span>
          </div>
        </div>

        {/* Operations Feed */}
        <div className="glass-premium bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-6 md:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col justify-between hover:shadow-2xl transition-all duration-300">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="space-y-1">
                <h2 className="text-lg font-black text-charcoal dark:text-white tracking-tight">
                  Operations Feed
                </h2>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Live Security & Audit
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-xl border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] font-black uppercase tracking-wider">
                  Live
                </span>
              </div>
            </div>

            <div className="space-y-3 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-white/10">
              {recentActivity.slice(0, 4).map((activity) => (
                <div key={activity.id} className="relative pl-7 group">
                  <div
                    className={clsx(
                      "absolute left-0.5 top-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-zinc-900 flex items-center justify-center z-10 transition-transform group-hover:scale-125",
                      activity.urgent
                        ? "bg-primary"
                        : "bg-slate-300 dark:bg-zinc-700 group-hover:bg-blue-500",
                    )}
                  />
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        {activity.time}
                      </p>
                      {activity.urgent && (
                        <AlertTriangle size={12} className="text-primary" />
                      )}
                    </div>
                    <p className="text-xs font-black text-charcoal dark:text-white leading-tight">
                      {activity.title}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium line-clamp-1">
                      {activity.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-white/5">
            <button
              onClick={openHistoryModal}
              className="w-full py-2.5 bg-slate-100 dark:bg-white/5 hover:bg-primary hover:text-white text-slate-600 dark:text-slate-300 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all border border-slate-200/60 dark:border-white/5 shadow-sm active:scale-95 flex items-center justify-center gap-2"
            >
              <Activity size={14} /> Full History Console
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Floor Snap-View */}
      <section className="glass-premium bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-[2.5rem] overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-none">
        <div className="p-6 md:p-8 flex flex-wrap items-center justify-between gap-6 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
              <Building2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-charcoal dark:text-white tracking-tight leading-none">
                Facility Status
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                Interactive Zoning Control
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <LegendItem color="bg-primary" label="Occupied" />
            <LegendItem color="bg-emerald-500" label="Available" />
            <LegendItem color="bg-amber-500" label="Restricted" />
            <Link
              href="/admindashboard/space-manager"
              className="ml-2 px-6 py-2 bg-charcoal dark:bg-white text-white dark:text-black font-black text-xs uppercase tracking-widest rounded-xl hover:scale-105 transition-all"
            >
              Full Architect
            </Link>
          </div>
        </div>

        <div className="p-8 bg-slate-50/50 dark:bg-black/20">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-10 gap-3">
            {floorSlots.map((slot) => (
              <div
                key={slot.id}
                className={clsx(
                  "aspect-square rounded-2xl border-2 p-3 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative group overflow-hidden",
                  slot.status === "occupied"
                    ? "bg-white dark:bg-primary/10 border-primary/20 text-primary hover:bg-primary hover:text-white shadow-sm"
                    : slot.status === "available"
                      ? "bg-white dark:bg-emerald-900/10 border-emerald-500/20 text-emerald-600 hover:bg-emerald-500 hover:text-white shadow-sm"
                      : "bg-white dark:bg-amber-900/10 border-amber-500/20 text-amber-600 hover:bg-amber-500 hover:text-white shadow-sm",
                )}
              >
                <MapPin
                  size={18}
                  className="mb-2 transition-transform group-hover:-translate-y-1"
                />
                <span className="font-black text-xs">{slot.id}</span>
                <span className="text-[8px] font-bold uppercase tracking-tighter opacity-70 mt-1">
                  {slot.status}
                </span>

                {slot.label && (
                  <div className="absolute inset-0 bg-primary flex items-center justify-center p-2 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[10px] font-black text-white leading-tight uppercase">
                      {slot.label}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* History Console Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 lg:p-8 animate-fade-in-up">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setShowHistoryModal(false)}
          />
          <div className="relative w-full max-w-4xl max-h-[85vh] bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl flex flex-col border border-slate-200 dark:border-white/10 overflow-hidden">
            <div className="flex items-center justify-between p-6 md:p-8 border-b border-slate-100 dark:border-white/5">
              <div>
                <h2 className="text-2xl font-black text-charcoal dark:text-white tracking-tight">
                  Full Operations History
                </h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Last 50 recorded events
                </p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-2 text-slate-400 hover:text-charcoal dark:hover:text-white bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-all"
              >
                <XCircle size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8">
              {loadingHistory ? (
                <div className="flex justify-center items-center py-20">
                  <RefreshCw className="animate-spin text-primary" size={32} />
                </div>
              ) : (
                <div className="space-y-4">
                  {fullHistory.map((activity) => (
                    <div
                      key={activity.id}
                      className={clsx(
                        "flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-2xl border transition-all",
                        activity.urgent
                          ? "border-red-500/30 bg-red-50 dark:bg-red-900/10"
                          : "border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 hover:border-slate-300 dark:hover:border-white/20"
                      )}
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          {activity.urgent && (
                            <AlertTriangle size={14} className="text-red-500" />
                          )}
                          <p className="text-sm font-black text-charcoal dark:text-white leading-tight">
                            {activity.title}
                          </p>
                          {activity.status && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-slate-300">
                              {activity.status}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          {activity.description}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between md:flex-col md:items-end gap-2 shrink-0">
                        <div className="text-right">
                          <p className="text-xs font-black text-slate-600 dark:text-slate-300">
                            {activity.time}
                          </p>
                          {activity.fullDate && (
                            <p className="text-[10px] font-bold text-slate-400">
                              {activity.fullDate}
                            </p>
                          )}
                        </div>
                        {activity.targetUrl && (
                          <Link
                            href={activity.targetUrl}
                            className="p-1.5 bg-white dark:bg-zinc-800 rounded-lg text-primary hover:scale-105 transition-transform shadow-sm"
                          >
                            <ArrowRight size={14} />
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                  {fullHistory.length === 0 && (
                    <div className="text-center py-10 text-slate-500">
                      No recent activity found.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Helper Components ---

function StatCard({
  title,
  value,
  trend,
  subtext,
  icon,
  color,
  chart,
}: {
  title: string;
  value: string;
  trend: string;
  subtext?: string;
  icon: React.ReactNode;
  color: string;
  chart?: boolean;
}) {
  const colorClasses =
    {
      primary: "text-primary bg-primary/10",
      blue: "text-blue-500 bg-blue-500/10",
      emerald: "text-emerald-500 bg-emerald-500/10",
      amber: "text-amber-500 bg-amber-500/10",
      purple: "text-purple-500 bg-purple-500/10",
    }[color] || "text-slate-500 bg-slate-500/10";

  return (
    <div className="glass-premium bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-[2rem] p-6 shadow-xl shadow-slate-200/40 dark:shadow-none hover:scale-[1.02] transition-all duration-300 group flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start mb-4">
          <div
            className={clsx(
              "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-12",
              colorClasses,
            )}
          >
            {icon}
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full flex items-center gap-1">
              <TrendingUp size={10} /> {trend}
            </span>
          </div>
        </div>
        <div className="space-y-1">
          <h3 className="text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-widest">
            {title}
          </h3>
          <p className="text-3xl font-black text-charcoal dark:text-white tracking-tight">
            {value}
          </p>
          {subtext && (
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-0.5">
              {subtext}
            </p>
          )}
        </div>
      </div>
      {chart && (
        <div className="mt-4 h-8 w-full overflow-hidden opacity-30 group-hover:opacity-60 transition-opacity">
          <svg
            viewBox="0 0 100 20"
            preserveAspectRatio="none"
            className="w-full h-full text-primary fill-current"
          >
            <path d="M0,20 L0,10 L10,14 L20,8 L30,12 L40,6 L50,14 L60,8 L70,12 L80,4 L90,14 L100,8 L100,20 Z" />
          </svg>
        </div>
      )}
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={clsx("w-2 h-2 rounded-full", color)} />
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {label}
      </span>
    </div>
  );
}
