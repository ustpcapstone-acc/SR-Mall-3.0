"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Star,
  TrendingUp,
  Store,
  ArrowRight,
  Receipt,
  MessageSquare,
  Zap,
  Award,
  Activity,
  Monitor,
  Sparkles,
  Calendar,
  ShieldCheck,
  MapPin,
  CheckCircle,
  ArrowUpRight,
  Clock,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/app/providers";
import { getApprovedReviewsAction } from "@/app/actions/review";
import { getStorefrontAction } from "@/app/actions/tenant";
import { getTenantPaymentScheduleAction } from "@/app/actions/finance";
import clsx from "clsx";

function SpinnerIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

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

        const result = await getApprovedReviewsAction(tId);
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

  const quickLinks = [
    {
      href: "/tenantdashboard/digital-storefront",
      label: "Storefront",
      icon: Store,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      href: "/tenantdashboard/ad-promo-manager",
      label: "Ads & Promos",
      icon: TrendingUp,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
    {
      href: "/tenantdashboard/customer-messenger",
      label: "Messenger",
      icon: MessageSquare,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      href: "/tenantdashboard/lease-payments",
      label: "Payments",
      icon: Receipt,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
  ];

  return (
    <div className="p-3 sm:p-5 lg:p-6 space-y-4 max-w-[1600px] mx-auto pb-20 lg:pb-6">
      {/* ── HEADER CARD ── */}
      <header className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-2xl px-5 py-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="relative shrink-0">
            <div className="w-12 h-12 bg-primary/10 rounded-xl border border-primary/20 flex items-center justify-center">
              <Store size={22} className="text-primary" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-zinc-900">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-500/15">
                <ShieldCheck size={9} /> Auth: High
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/8 text-primary rounded-full text-[9px] font-black uppercase tracking-widest border border-primary/15">
                <Zap size={9} /> Live
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-charcoal dark:text-white tracking-tighter uppercase italic leading-none">
              Control <span className="text-primary not-italic">Center.</span>
            </h1>
            <p className="text-[11px] text-slate-500 font-semibold mt-0.5 flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1">
                <Store size={10} />{" "}
                <span className="truncate max-w-[120px] sm:max-w-none">
                  {shopName || "Boutique Terminal"}
                </span>
              </span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="flex items-center gap-1">
                <MapPin size={10} className="text-primary/50" /> Unit{" "}
                {unitId || "L1-105"}
              </span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="flex items-center gap-1">
                <Star size={10} className="text-amber-400 fill-amber-400" />{" "}
                {isLoading ? "—" : avgRating}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
              Synced
            </span>
          </div>
          <button className="p-2.5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl text-slate-400 hover:text-primary transition-all">
            <Activity size={18} />
          </button>
          <Link
            href="/tenantdashboard/digital-storefront"
            className="hidden sm:flex items-center gap-1.5 px-4 py-2.5 bg-charcoal dark:bg-white text-white dark:text-charcoal rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-primary dark:hover:bg-primary dark:hover:text-white transition-all shadow-lg group"
          >
            Storefront{" "}
            <ArrowUpRight
              size={14}
              className="group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform"
            />
          </Link>
        </div>
      </header>

      {/* ── MAIN BENTO GRID ── */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {/* ── KPI CARD 1: SENTIMENT ── */}
        <div className="col-span-1 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:scale-[1.02] transition-all flex flex-col justify-between">
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-amber-500/5 blur-[40px] rounded-full pointer-events-none" />
          <div className="w-9 h-9 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center group-hover:rotate-12 transition-transform">
            <Star size={18} />
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Sentiment Rating
            </p>
            <div className="flex items-end justify-between gap-1">
              <span className="text-2xl font-black text-charcoal dark:text-white tracking-tighter">
                {isLoading ? "—" : avgRating.toFixed(1)}
              </span>
              <span className="text-[9px] font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-lg mb-0.5">
                Stars
              </span>
            </div>
          </div>
        </div>

        {/* ── KPI CARD 2: REVIEWS ── */}
        <div className="col-span-1 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:scale-[1.02] transition-all flex flex-col justify-between">
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-primary/5 blur-[40px] rounded-full pointer-events-none" />
          <div className="w-9 h-9 bg-primary/10 text-primary rounded-xl flex items-center justify-center group-hover:-rotate-12 transition-transform">
            <MessageSquare size={18} />
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Total Feedback
            </p>
            <div className="flex items-end justify-between gap-1">
              <span className="text-2xl font-black text-charcoal dark:text-white tracking-tighter">
                {isLoading ? "—" : liveReviews.length}
              </span>
              <span className="text-[9px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-lg mb-0.5">
                Reviews
              </span>
            </div>
          </div>
        </div>

        {/* ── STOREFRONT MANIFEST (col-span 4, row-span 2 on lg) ── */}
        <div className="col-span-2 lg:col-span-4 lg:row-span-2 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden group flex flex-col relative">
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 blur-[80px] rounded-full pointer-events-none" />
          <div className="px-6 py-4 border-b border-slate-50 dark:border-white/5 flex items-center justify-between bg-white/40 dark:bg-black/10 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                <Monitor size={17} />
              </div>
              <div>
                <p className="text-[11px] font-black text-charcoal dark:text-white uppercase tracking-wider leading-none">
                  Manifest Presence
                </p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                  Digital Identity Core
                </p>
              </div>
            </div>
            <Link
              href="/tenantdashboard/digital-storefront"
              className="p-2 bg-white dark:bg-zinc-800 rounded-lg text-primary hover:scale-110 transition-transform shadow-sm border border-slate-100 dark:border-white/5"
            >
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="px-6 py-5 flex-1 flex items-center relative z-10">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 w-full">
              <div className="relative shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-50 dark:bg-black/40 border-4 border-white dark:border-zinc-800 shadow-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                  <Store size={36} className="text-slate-300" />
                </div>
                <div className="absolute -bottom-1.5 -right-1.5 bg-emerald-500 p-1.5 rounded-xl text-white shadow-lg border-2 border-white dark:border-zinc-900">
                  <ShieldCheck size={13} />
                </div>
              </div>
              <div className="flex-1 text-center sm:text-left space-y-3 min-w-0">
                <div>
                  <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-charcoal dark:text-white uppercase italic tracking-tight leading-none break-words">
                    {shopName || "Boutique Terminal"}
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold mt-1.5 flex items-center justify-center sm:justify-start gap-1.5">
                    <MapPin size={11} className="text-primary" /> Verified Mall
                    Partner • Unit {unitId || "L1-105"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-600 rounded-xl border border-amber-500/20 text-[10px] font-black uppercase tracking-wider">
                    <Star size={11} className="fill-current" /> {avgRating}{" "}
                    Sentiment
                  </span>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-600 rounded-xl border border-blue-500/20 text-[10px] font-black uppercase tracking-wider">
                    <Activity size={11} /> High Visibility
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-slate-50 dark:divide-white/5 border-t border-slate-50 dark:border-white/5 relative z-10">
            {[
              { label: "Recall", value: "92%", icon: Zap },
              { label: "Rank", value: "#04", icon: Award },
              { label: "Tier", value: "Elite", icon: ShieldCheck },
            ].map((s) => (
              <div
                key={s.label}
                className="py-3 flex flex-col items-center gap-0.5 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors cursor-default group/s"
              >
                <p className="text-xs font-black text-charcoal dark:text-white italic uppercase tracking-tight group-hover/s:text-primary transition-colors">
                  {s.value}
                </p>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── LIVE SIGNALS (col-span 2, row-span 2) ── */}
        <div className="col-span-2 lg:row-span-2 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-50 dark:border-white/5 flex items-center justify-between bg-white/40 dark:bg-black/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-amber-500/10 text-amber-500 rounded-lg flex items-center justify-center">
                <Star size={16} />
              </div>
              <span className="text-[11px] font-black text-charcoal dark:text-white uppercase tracking-[0.3em]">
                Live Signals
              </span>
            </div>
            <Link
              href="/tenantdashboard/feedback-reviews"
              className="p-1.5 bg-slate-50 dark:bg-white/5 hover:bg-primary/10 text-slate-400 hover:text-primary rounded-lg transition-all border border-slate-100 dark:border-white/5"
            >
              <ArrowUpRight size={15} />
            </Link>
          </div>
          <div
            className="flex-1 overflow-y-auto divide-y divide-slate-50 dark:divide-white/5 max-h-[280px] lg:max-h-none"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(0,0,0,0.05) transparent",
            }}
          >
            {isLoading ? (
              <div className="py-10 flex justify-center">
                <SpinnerIcon className="text-primary animate-spin" />
              </div>
            ) : liveReviews.length > 0 ? (
              liveReviews.slice(0, 5).map((r, i) => (
                <div
                  key={i}
                  className="px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-all border-l-2 border-transparent hover:border-primary cursor-default"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black text-xs shrink-0 capitalize border border-primary/10">
                      {r.user?.name?.[0] || "S"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-[10px] font-black text-charcoal dark:text-white truncate uppercase tracking-tight">
                          {r.user?.name?.split(" ")[0] || "Shopper"}
                        </p>
                        <div className="flex gap-0.5 shrink-0">
                          {[...Array(5)].map((_, s) => (
                            <Sparkles
                              key={s}
                              size={8}
                              className={
                                s < r.rating
                                  ? "text-amber-400 fill-amber-400"
                                  : "text-slate-200 dark:text-zinc-800"
                              }
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 italic line-clamp-1">
                        "{r.comment || "Performance certified."}"
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 flex flex-col items-center gap-2 opacity-40">
                <MessageSquare size={28} className="text-slate-300" />
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  No signals yet
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── QUICK ACCESS LINKS ── */}
        {quickLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="col-span-1 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all group flex flex-col items-center text-center gap-3"
          >
            <div
              className={clsx(
                "w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm",
                item.bg,
                item.color,
              )}
            >
              <item.icon size={20} />
            </div>
            <p className="text-[10px] font-black text-charcoal dark:text-white uppercase tracking-widest leading-tight group-hover:text-primary transition-colors">
              {item.label}
            </p>
          </Link>
        ))}
      </div>

      {/* ── PAYMENT SCHEDULE SECTION ── */}
      <section className="bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl shadow-sm p-5 sm:p-6 relative overflow-hidden group">
        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/5 blur-[90px] rounded-full pointer-events-none" />

        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-50 dark:border-white/5 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center shrink-0 border border-emerald-500/15">
              <Calendar size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-charcoal dark:text-white uppercase tracking-wider leading-none">
                  Payment Schedule
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 rounded-full text-[9px] font-black uppercase tracking-widest">
                  Remittance Cycle
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                Dues timeline, next scheduled billing &amp; payment records
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {paymentSchedule && (
              <span
                className={clsx(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                  paymentSchedule.paymentStatus === "Paid"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : paymentSchedule.paymentStatus === "Overdue"
                      ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                      : paymentSchedule.paymentStatus === "Reviewing"
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                )}
              >
                <span
                  className={clsx(
                    "w-1.5 h-1.5 rounded-full",
                    paymentSchedule.paymentStatus === "Paid"
                      ? "bg-emerald-500 animate-pulse"
                      : paymentSchedule.paymentStatus === "Overdue"
                        ? "bg-red-500 animate-ping"
                        : paymentSchedule.paymentStatus === "Reviewing"
                          ? "bg-blue-500 animate-pulse"
                          : "bg-amber-500 animate-pulse",
                  )}
                />
                {paymentSchedule.paymentStatus === "Paid"
                  ? "Settled / Up to Date"
                  : paymentSchedule.paymentStatus === "Overdue"
                    ? "Overdue Account"
                    : paymentSchedule.paymentStatus === "Reviewing"
                      ? "Proof Under Review"
                      : "Payment Due"}
              </span>
            )}

            <Link
              href="/tenantdashboard/lease-payments"
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 dark:bg-white/5 hover:bg-primary/10 text-slate-500 dark:text-slate-400 hover:text-primary rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-100 dark:border-white/5"
            >
              <span>Lease &amp; Billing</span>
              <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>

        {/* 5 Core Schedule Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 pt-5 relative z-10">
          {/* 1. Next Payment Date */}
          <div className="bg-slate-50/60 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl p-4 flex flex-col justify-between hover:border-emerald-500/30 transition-all group/box">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Next Payment Date
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Calendar size={14} />
              </div>
            </div>
            <div>
              <p className="text-lg sm:text-xl font-black text-charcoal dark:text-white tracking-tight leading-snug">
                {isLoadingSchedule
                  ? "—"
                  : formatDate(paymentSchedule?.nextPaymentDate)}
              </p>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-0.5">
                {paymentSchedule?.paymentStatus === "Overdue"
                  ? "Immediate Settlement Required"
                  : paymentSchedule?.paymentStatus === "Paid"
                    ? "Next Billing Cycle"
                    : "Due Date"}
              </p>
            </div>
          </div>

          {/* 2. Payment Month */}
          <div className="bg-slate-50/60 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl p-4 flex flex-col justify-between hover:border-blue-500/30 transition-all group/box">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Payment Month
              </span>
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Clock size={14} />
              </div>
            </div>
            <div>
              <p className="text-lg sm:text-xl font-black text-charcoal dark:text-white tracking-tight leading-snug truncate">
                {isLoadingSchedule
                  ? "—"
                  : paymentSchedule?.paymentMonth || "Current Cycle"}
              </p>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-0.5">
                Billing Period
              </p>
            </div>
          </div>

          {/* 3. Payment Amount */}
          <div className="bg-slate-50/60 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl p-4 flex flex-col justify-between hover:border-primary/30 transition-all group/box">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Payment Amount
              </span>
              <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Receipt size={14} />
              </div>
            </div>
            <div>
              <p className="text-lg sm:text-xl font-black text-primary tracking-tight leading-snug">
                {isLoadingSchedule
                  ? "—"
                  : `₱${(paymentSchedule?.paymentAmount || 0).toLocaleString()}`}
              </p>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-0.5 truncate">
                {paymentSchedule?.invoiceNumber
                  ? `Invoice ${paymentSchedule.invoiceNumber}`
                  : "Monthly Rental Fee"}
              </p>
            </div>
          </div>

          {/* 4. Payment Status */}
          <div className="bg-slate-50/60 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl p-4 flex flex-col justify-between hover:border-amber-500/30 transition-all group/box">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Payment Status
              </span>
              <div
                className={clsx(
                  "w-7 h-7 rounded-lg flex items-center justify-center",
                  paymentSchedule?.paymentStatus === "Paid"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : paymentSchedule?.paymentStatus === "Overdue"
                      ? "bg-red-500/10 text-red-600 dark:text-red-400"
                      : paymentSchedule?.paymentStatus === "Reviewing"
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                )}
              >
                {paymentSchedule?.paymentStatus === "Paid" ? (
                  <CheckCircle size={14} />
                ) : paymentSchedule?.paymentStatus === "Overdue" ? (
                  <AlertCircle size={14} />
                ) : (
                  <Clock size={14} />
                )}
              </div>
            </div>
            <div>
              <span
                className={clsx(
                  "text-lg sm:text-xl font-black uppercase tracking-tight leading-snug",
                  paymentSchedule?.paymentStatus === "Paid"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : paymentSchedule?.paymentStatus === "Overdue"
                      ? "text-red-600 dark:text-red-400"
                      : paymentSchedule?.paymentStatus === "Reviewing"
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-amber-600 dark:text-amber-400",
                )}
              >
                {isLoadingSchedule
                  ? "—"
                  : paymentSchedule?.paymentStatus || "Pending"}
              </span>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-0.5">
                {paymentSchedule?.paymentStatus === "Paid"
                  ? "Cleared Standing"
                  : paymentSchedule?.paymentStatus === "Overdue"
                    ? "Past Due Date"
                    : paymentSchedule?.paymentStatus === "Reviewing"
                      ? "Awaiting Admin Verification"
                      : "Awaiting Remittance"}
              </p>
            </div>
          </div>

          {/* 5. Last Payment Date */}
          <div className="bg-slate-50/60 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl p-4 flex flex-col justify-between hover:border-purple-500/30 transition-all group/box sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Last Payment Date
              </span>
              <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <ShieldCheck size={14} />
              </div>
            </div>
            <div>
              <p className="text-lg sm:text-xl font-black text-charcoal dark:text-white tracking-tight leading-snug">
                {isLoadingSchedule
                  ? "—"
                  : paymentSchedule?.lastPaymentDate
                    ? formatDate(paymentSchedule.lastPaymentDate)
                    : "None recorded"}
              </p>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-0.5">
                {paymentSchedule?.lastPaymentDate
                  ? "Last Settled Transaction"
                  : "No Prior Remittance"}
              </p>
            </div>
          </div>
        </div>

        {/* Ledger Summary & Action Link */}
        <div className="mt-4 pt-4 border-t border-slate-50 dark:border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[10px] text-slate-500">
          <div className="flex items-center gap-2 flex-wrap font-medium">
            <span className="font-bold text-charcoal dark:text-white uppercase tracking-wider">
              Payment Record:
            </span>
            <span>
              {paymentSchedule
                ? `${paymentSchedule.paidInvoicesCount ?? 0} of ${paymentSchedule.totalInvoices ?? 0} Invoices Cleared`
                : "Checking ledger..."}
            </span>
            {(paymentSchedule?.totalUnpaidBalance ?? 0) > 0 && (
              <span className="text-red-500 font-bold">
                • Total Outstanding: ₱{(paymentSchedule?.totalUnpaidBalance ?? 0).toLocaleString()}
              </span>
            )}
          </div>

          <Link
            href="/tenantdashboard/lease-payments"
            className="inline-flex items-center gap-1.5 text-[10px] font-black text-primary hover:text-primary-hover uppercase tracking-widest group/link shrink-0"
          >
            <span>Submit Proof of Payment</span>
            <ArrowRight
              size={12}
              className="group-hover/link:translate-x-1 transition-transform"
            />
          </Link>
        </div>
      </section>
    </div>
  );
}
