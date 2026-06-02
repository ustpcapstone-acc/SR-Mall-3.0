"use client";

import React, { useEffect, useState } from "react";
import {
  ShieldCheck,
  User,
  Store,
  CheckCircle2,
  XCircle,
  Loader2,
  Mail,
  ExternalLink,
  MapPin,
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  MessageSquare,
  ShieldAlert,
  AlertTriangle,
  Building,
  Bookmark,
  Sparkles,
  Search,
  Filter,
  ChevronDown,
  Save,
  MoreVertical,
  ArrowRight,
  Activity,
  Handshake,
  Monitor,
} from "lucide-react";
import {
  getPendingTenantsAction,
  approveTenantAction,
  rejectTenantAction,
} from "@/app/actions/tenant";
import {
  getAreaSlots,
  approveReservationAction,
  rejectReservationAction,
  upsertAreaSlot,
} from "@/app/actions/space-slot";
import {
  getInquiriesAction,
  updateInquiryStatusAction,
} from "@/app/actions/inquiry";
import { toast } from "sonner";
import clsx from "clsx";

// Calendar Helpers
const getDaysInMonth = (year: number, month: number) =>
  new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) =>
  new Date(year, month, 1).getDay();
const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function MasterBookingsPage() {
  const [activeTab, setActiveTab] = useState<
    "merchant" | "event" | "reservation"
  >("merchant");
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Merchant Requests State
  const [merchantRequests, setMerchantRequests] = useState<any[]>([]);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [isApprovingMerchant, setIsApprovingMerchant] = useState<string | null>(
    null,
  );
  const [selectedUnits, setSelectedUnits] = useState<Record<string, string>>(
    {},
  );
  const [openSelectId, setOpenSelectId] = useState<string | null>(null);

  // Event Inquiries State
  const [eventInquiries, setEventInquiries] = useState<any[]>([]);
  const [isProcessingEvent, setIsProcessingEvent] = useState<string | null>(
    null,
  );
  const [modalInquiry, setModalInquiry] = useState<any | null>(null);
  const [modalAction, setModalAction] = useState<
    "ACCEPTED" | "REJECTED" | null
  >(null);
  const [feedback, setFeedback] = useState("");

  // Reservation Queue State
  const [reservedSlots, setReservedSlots] = useState<any[]>([]);

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(
    null,
  );
  const [calendarModalEvents, setCalendarModalEvents] = useState<any[]>([]);

  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsSyncing(true);

    try {
      const [tenants, slots, inquiries] = await Promise.all([
        getPendingTenantsAction(),
        getAreaSlots(),
        getInquiriesAction(),
      ]);

      if (tenants.success) setMerchantRequests(tenants.data || []);
      if (slots.success) {
        setAvailableSlots(
          slots.data?.filter((s: any) => s.status === "AVAILABLE") || [],
        );
        setReservedSlots(
          slots.data?.filter((s: any) => s.status === "RESERVED") || [],
        );
      }
      if (inquiries.success) setEventInquiries(inquiries.data || []);
    } catch (err) {
      toast.error("Data synchronization failed");
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- Merchant Handlers ---
  const handleApproveMerchant = async (tenantId: string) => {
    const unitId = selectedUnits[tenantId];
    if (
      !unitId &&
      !confirm(
        "Strategic Warning: No Physical Unit is assigned. Approve anyway?",
      )
    )
      return;

    try {
      setIsApprovingMerchant(tenantId);
      const res = await approveTenantAction(tenantId, unitId);
      if (res.success) {
        toast.success("Merchant Partnership Synchronized");
        loadData(true);
      } else {
        toast.error("Integration Failed", { description: res.error });
      }
    } finally {
      setIsApprovingMerchant(null);
    }
  };

  const handleRejectMerchant = async (tenantId: string) => {
    if (confirm("Terminate this application strategy?")) {
      const res = await rejectTenantAction(tenantId);
      if (res.success) {
        toast.warning("Application Rejected");
        loadData(true);
      }
    }
  };

  // --- Event Handlers ---
  const handleEventActionClick = (
    inquiry: any,
    action: "ACCEPTED" | "REJECTED",
  ) => {
    setModalInquiry(inquiry);
    setModalAction(action);
    setFeedback("");
  };

  const submitEventAction = async () => {
    if (!modalInquiry || !modalAction) return;
    if (modalAction === "REJECTED" && !feedback.trim()) {
      toast.error("Policy: Feedback is required for rejection.");
      return;
    }

    setIsProcessingEvent(modalInquiry.id);
    const result = await updateInquiryStatusAction(
      modalInquiry.id,
      modalAction,
      feedback,
    );
    if (result.success) {
      toast.success(
        `Schedule ${modalAction === "ACCEPTED" ? "Locked" : "Released"}`,
      );
      loadData(true);
      setModalInquiry(null);
    } else {
      toast.error("Execution failure.");
    }
    setIsProcessingEvent(null);
  };

  // --- Reservation Handlers ---
  const handleApproveReservation = async (unitId: string) => {
    if (confirm(`Approve strategic reservation for Unit ${unitId}?`)) {
      const res = await approveReservationAction(unitId);
      if (res.success) {
        toast.success("Inventory Slot Secured");
        loadData(true);
      }
    }
  };

  const handleRejectReservation = async (slot: any) => {
    if (
      confirm(
        `Release reservation for Unit ${slot.unit_id}? Space status will revert to AVAILABLE.`,
      )
    ) {
      const res = await rejectReservationAction(slot.unit_id);
      if (res.success) {
        toast.warning("Inventory Slot Released");
        loadData(true);
      }
    }
  };

  // --- Calendar Logic ---
  const pendingEvents = eventInquiries.filter((i) => i.status === "PENDING");
  const acceptedEvents = eventInquiries.filter((i) => i.status === "ACCEPTED");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);

  const getEventsForDay = (day: number) => {
    return acceptedEvents.filter((inq) => {
      const inqDate = new Date(inq.eventDate);
      return (
        inqDate.getDate() === day &&
        inqDate.getMonth() === month &&
        inqDate.getFullYear() === year
      );
    });
  };

  const handleDayClick = (day: number) => {
    const events = getEventsForDay(day);
    if (events.length > 0) {
      setSelectedCalendarDate(new Date(year, month, day));
      setCalendarModalEvents(events);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Activity size={20} className="text-primary animate-pulse" />
          </div>
        </div>
        <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">
          Loading Operational Data...
        </p>
      </div>
    );
  }

  const tabs = [
    {
      id: "merchant",
      label: "Merchant Onboarding",
      icon: Handshake,
      count: merchantRequests.length,
    },
    {
      id: "event",
      label: "Experience Desk",
      icon: CalendarIcon,
      count: pendingEvents.length,
    },
    {
      id: "reservation",
      label: "Inventory Queue",
      icon: Bookmark,
      count: reservedSlots.length,
    },
  ];

  return (
    <div className="p-4 md:p-8 lg:p-10 animate-fade-in-up space-y-10 min-h-screen max-w-[1800px] mx-auto">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-8 border-b border-slate-200 dark:border-white/10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/20">
            <ShieldCheck size={12} /> Access Level: Master Admin
          </div>
          <h1 className="text-5xl font-black text-charcoal dark:text-white tracking-tighter italic uppercase leading-none">
            Operations <span className="text-primary">Hub.</span>
          </h1>
          <p className="text-slate-500 font-medium max-w-2xl text-lg">
            Synchronize partnerships, experience schedules, and physical
            inventory from your master command console.
          </p>
        </div>

        <div className="flex items-center gap-4">
          {isSyncing && (
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-zinc-800 rounded-full animate-pulse">
              <Loader2 size={12} className="animate-spin text-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Live Sync
              </span>
            </div>
          )}
          <div className="h-10 w-px bg-slate-200 dark:bg-white/10 hidden md:block mx-2" />
          <button
            onClick={() => loadData(true)}
            className="p-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-400 hover:text-primary transition-all shadow-sm"
          >
            <Monitor size={20} />
          </button>
        </div>
      </div>

      {/* Modern Tabs */}
      <div className="bg-white dark:bg-zinc-900/50 p-2 rounded-[2rem] border border-slate-200 dark:border-white/5 flex gap-2 w-fit overflow-x-auto custom-scrollbar shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={clsx(
              "flex items-center gap-3 px-8 py-4 rounded-2xl transition-all relative whitespace-nowrap active:scale-95",
              activeTab === tab.id
                ? "bg-primary text-white shadow-xl shadow-primary/25"
                : "text-slate-400 hover:text-charcoal dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5",
            )}
          >
            <tab.icon size={18} />
            <span className="text-[11px] font-black uppercase tracking-widest">
              {tab.label}
            </span>
            {tab.count > 0 && (
              <span
                className={clsx(
                  "px-2 py-0.5 rounded-full text-[9px] font-bold border",
                  activeTab === tab.id
                    ? "bg-white text-primary border-white"
                    : "bg-primary/10 text-primary border-primary/20",
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Dynamic Content Area */}
      <main className="animate-fade-in group">
        {activeTab === "merchant" && (
          <div className="space-y-8">
            <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-[2.5rem] shadow-sm">
              <div className="custom-scrollbar w-full">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-white/5">
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-white/5">
                        Applicant Identity
                      </th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-white/5">
                        Operational Concept
                      </th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-white/5">
                        Strategic Unit
                      </th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-white/5 text-right">
                        Approval Protocol
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {merchantRequests.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="p-32 text-center text-slate-400 font-bold uppercase tracking-widest text-xs"
                        >
                          No Pending Applications
                        </td>
                      </tr>
                    ) : (
                      merchantRequests.map((req) => (
                        <tr
                          key={req.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors group/row"
                        >
                          <td className="px-8 py-8">
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="shrink-0 w-14 h-14 bg-primary/10 rounded-[1.25rem] flex items-center justify-center text-primary group-hover/row:scale-110 transition-transform">
                                <User size={24} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-black text-charcoal dark:text-white uppercase tracking-tight italic truncate">
                                  {req.user?.name}
                                </p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 truncate">
                                  {req.user?.email}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-8 max-w-sm">
                            <div className="space-y-1">
                              <span className="inline-block px-2 py-0.5 bg-slate-100 dark:bg-white/10 rounded text-[9px] font-black text-slate-500 uppercase mb-2">
                                Retail Partnership
                              </span>
                              <h4 className="text-sm font-black text-charcoal dark:text-white uppercase tracking-tight">
                                {req.shopName}
                              </h4>
                              <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed italic break-all">
                                "{req.description}"
                              </p>
                            </div>
                          </td>
                          <td className="px-8 py-8">
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setOpenSelectId(openSelectId === req.id ? null : req.id)}
                                  className="bg-slate-100 dark:bg-zinc-800 border-none rounded-2xl px-5 py-3 text-xs font-black text-charcoal dark:text-white flex items-center justify-between gap-2 min-w-[220px] transition-all hover:bg-slate-200 dark:hover:bg-zinc-700 outline-none"
                                >
                                  <span>
                                    {selectedUnits[req.id]
                                      ? `UNIT ${selectedUnits[req.id]}`
                                      : "PENDING ASSIGNMENT"}
                                  </span>
                                  <ChevronDown size={14} className="text-slate-400 dark:text-slate-500" />
                                </button>

                                {openSelectId === req.id && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-40"
                                      onClick={() => setOpenSelectId(null)}
                                    />
                                    <div className="absolute left-0 bottom-full mb-2 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl shadow-xl z-50 py-2 max-h-60 overflow-y-auto custom-scrollbar animate-fade-in">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedUnits({
                                            ...selectedUnits,
                                            [req.id]: "",
                                          });
                                          setOpenSelectId(null);
                                        }}
                                        className={clsx(
                                          "w-full text-left px-5 py-3 text-xs font-black transition-all hover:bg-slate-100 dark:hover:bg-zinc-800",
                                          !selectedUnits[req.id]
                                            ? "text-primary"
                                            : "text-slate-500 dark:text-zinc-300"
                                        )}
                                      >
                                        PENDING ASSIGNMENT
                                      </button>
                                      {availableSlots.map((slot: any) => (
                                        <button
                                          key={slot.id}
                                          type="button"
                                          onClick={() => {
                                            setSelectedUnits({
                                              ...selectedUnits,
                                              [req.id]: slot.unit_id,
                                            });
                                            setOpenSelectId(null);
                                          }}
                                          className={clsx(
                                            "w-full text-left px-5 py-3 text-xs font-black transition-all hover:bg-slate-100 dark:hover:bg-zinc-800",
                                            selectedUnits[req.id] === slot.unit_id
                                              ? "text-primary"
                                              : "text-slate-800 dark:text-zinc-100"
                                          )}
                                        >
                                          {slot.unit_id} — {slot.sqm_size}m²
                                        </button>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                          </td>
                          <td className="px-8 py-8 text-right">
                            <div className="flex justify-end gap-3 opacity-0 group-hover/row:opacity-100 transition-all duration-300">
                              <button
                                onClick={() => handleApproveMerchant(req.id)}
                                disabled={isApprovingMerchant === req.id}
                                className="px-6 py-3 bg-primary text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                              >
                                {isApprovingMerchant === req.id ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <CheckCircle2 size={12} />
                                )}
                                Sync Approve
                              </button>
                              <button
                                onClick={() => handleRejectMerchant(req.id)}
                                className="px-6 py-3 text-red-500 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-red-500/10 active:scale-95 transition-all"
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "event" && (
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-10">
            {/* Inquiry List */}
            <div className="xl:col-span-3 space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-charcoal dark:text-white uppercase italic tracking-tighter">
                  Experience <span className="text-primary">Queue.</span>
                </h2>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {pendingEvents.length} Pending Actions
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {pendingEvents.length === 0 ? (
                  <div className="md:col-span-2 py-32 text-center bg-white dark:bg-zinc-900 rounded-[3rem] border-2 border-dashed border-slate-100 dark:border-white/5">
                    <CalendarIcon
                      size={48}
                      className="text-slate-200 mx-auto mb-4"
                    />
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      Master Calendar is Clear
                    </p>
                  </div>
                ) : (
                  pendingEvents.map((inq) => (
                    <div
                      key={inq.id}
                      className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/5 flex flex-col justify-between group/card hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 group-hover:blur-[2px] hover:!blur-0"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-6">
                          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                            <Clock size={20} />
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black text-charcoal dark:text-white uppercase tracking-widest">
                              {new Date(inq.eventDate).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                              {inq.eventTime}
                            </p>
                          </div>
                        </div>
                        <span className="px-2 py-1 bg-primary text-white text-[8px] font-black uppercase tracking-widest rounded mb-3 inline-block">
                          {inq.eventType}
                        </span>
                        <h3 className="text-xl font-black text-charcoal dark:text-white uppercase tracking-tight leading-tight italic">
                          {inq.user?.name || "Anonymous User"}
                        </h3>
                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-1 mb-6">
                          {inq.user?.email}
                        </p>
                        <div className="p-4 bg-slate-50 dark:bg-black rounded-2xl border border-slate-100 dark:border-white/5 mb-8">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                            <MessageSquare size={12} /> Inquiry Message
                          </p>
                          <p className="text-xs text-charcoal dark:text-white/80 leading-relaxed line-clamp-2">
                            "{inq.message || "No contextual message provided."}"
                          </p>
                          {inq.imageUrl && (
                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Sparkles size={12} /> Attached Image
                              </p>
                              <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-100 dark:bg-zinc-800">
                                <img
                                  src={inq.imageUrl}
                                  alt="Inquiry Attachment"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() =>
                            handleEventActionClick(inq, "ACCEPTED")
                          }
                          className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all"
                        >
                          Secure
                        </button>
                        <button
                          onClick={() =>
                            handleEventActionClick(inq, "REJECTED")
                          }
                          className="flex-1 py-4 border border-slate-200 dark:border-white/10 text-slate-500 hover:text-red-500 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                        >
                          Deny
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Master Schedule Calendar */}
            <div className="xl:col-span-2 space-y-8">
              <h2 className="text-xl font-black text-charcoal dark:text-white uppercase italic tracking-tighter">
                Strategic <span className="text-primary">Schedule.</span>
              </h2>
              <div className="bg-white dark:bg-zinc-900 rounded-[3rem] p-10 border border-slate-100 dark:border-white/5 shadow-sm">
                <div className="flex items-center justify-between mb-10">
                  <button
                    onClick={handlePrevMonth}
                    className="p-3 bg-slate-100 dark:bg-white/5 rounded-2xl text-slate-500 hover:text-charcoal dark:hover:text-white transition-all"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <div className="text-center">
                    <h3 className="text-2xl font-black text-charcoal dark:text-white uppercase tracking-tighter leading-none italic">
                      {MONTHS[month]}
                    </h3>
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mt-1">
                      {year}
                    </p>
                  </div>
                  <button
                    onClick={handleNextMonth}
                    className="p-3 bg-slate-100 dark:bg-white/5 rounded-2xl text-slate-500 hover:text-charcoal dark:hover:text-white transition-all"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {DAYS_OF_WEEK.map((d) => (
                    <div
                      key={d}
                      className="text-center text-[10px] font-black text-slate-300 uppercase mb-4"
                    >
                      {d}
                    </div>
                  ))}
                  {blanks.map((b) => (
                    <div
                      key={`b-${b}`}
                      className="aspect-square bg-slate-50/50 dark:bg-white/[0.02] rounded-2xl"
                    />
                  ))}
                  {days.map((d) => {
                    const evs = getEventsForDay(d);
                    const isToday =
                      new Date().getDate() === d &&
                      new Date().getMonth() === month &&
                      new Date().getFullYear() === year;
                    return (
                      <div
                        key={d}
                        onClick={() => handleDayClick(d)}
                        className={clsx(
                          "aspect-square rounded-[1.25rem] flex items-center justify-center relative cursor-pointer transition-all border group",
                          evs.length > 0
                            ? "bg-primary border-primary text-white shadow-xl shadow-primary/20 scale-105 z-10"
                            : "bg-white dark:bg-zinc-900 border-transparent hover:border-slate-200 dark:hover:border-white/10",
                        )}
                      >
                        <span
                          className={clsx(
                            "text-xs font-black",
                            isToday && evs.length === 0 ? "text-primary" : "",
                          )}
                        >
                          {d}
                        </span>
                        {evs.length > 0 && (
                          <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-10 pt-10 border-t border-slate-100 dark:border-white/5 space-y-4">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <span>Confirmed Slates</span>
                    <span className="text-emerald-500">
                      {acceptedEvents.length} Active
                    </span>
                  </div>
                  <p className="text-[10px] font-medium leading-relaxed uppercase grey-text">
                    Click any high-intensity date to view detailed engagement
                    manifests.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "reservation" && (
          <div className="space-y-8">
            <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-[2.5rem] shadow-sm overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-white/5">
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-white/5">
                        Inventory Unit
                      </th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-white/5">
                        Slate Specifications
                      </th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-white/5">
                        Assigned Risk
                      </th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-white/5 text-right">
                        Queue Protocol
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {reservedSlots.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="p-32 text-center text-slate-400 font-bold uppercase tracking-widest text-xs"
                        >
                          Zero Pending Blockages
                        </td>
                      </tr>
                    ) : (
                      reservedSlots.map((res) => (
                        <tr
                          key={res.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors group/row"
                        >
                          <td className="px-8 py-8">
                            <div className="flex items-center gap-4">
                              <div className="w-14 h-14 bg-amber-500/10 rounded-[1.25rem] flex items-center justify-center text-amber-500 transition-transform group-hover/row:scale-110">
                                <Building size={24} />
                              </div>
                              <div>
                                <p className="font-black text-xl text-charcoal dark:text-white uppercase tracking-tighter italic leading-none">
                                  {res.unit_id}
                                </p>
                                <p className="text-[10px] text-amber-500 font-black uppercase tracking-widest mt-1">
                                  Status: RESERVED
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-8">
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-black text-charcoal dark:text-white uppercase tracking-tight">
                                {res.sqm_size} SQM TOTAL
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                ₱{res.base_rent.toLocaleString()} Base Rent / Mo
                              </span>
                            </div>
                          </td>
                          <td className="px-8 py-8">
                            <span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-500/20">
                              <ShieldCheck size={12} /> Institutional Low
                            </span>
                          </td>
                          <td className="px-8 py-8 text-right">
                            <div className="flex justify-end gap-3 opacity-0 group-hover/row:opacity-100 transition-all duration-300">
                              <button
                                onClick={() =>
                                  handleApproveReservation(res.unit_id)
                                }
                                className="px-8 py-4 bg-primary text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectReservation(res)}
                                className="px-8 py-4 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-500 hover:text-red-500 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Shared Modals */}
      {modalInquiry && (
        <div className="fixed inset-0 bg-charcoal/80 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-[3rem] p-10 max-w-lg w-full shadow-2xl relative border border-white/10 animate-scale-in">
            <button
              onClick={() => setModalInquiry(null)}
              className="absolute top-8 right-8 w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-400 hover:text-charcoal transition-all flex items-center justify-center active:scale-90"
            >
              <X size={20} />
            </button>
            <div className="flex items-center gap-4 mb-8">
              <div
                className={clsx(
                  "w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-lg",
                  modalAction === "ACCEPTED"
                    ? "bg-emerald-500 text-white shadow-emerald-500/20"
                    : "bg-red-500 text-white shadow-red-500/20",
                )}
              >
                {modalAction === "ACCEPTED" ? (
                  <CheckCircle2 size={28} />
                ) : (
                  <XCircle size={28} />
                )}
              </div>
              <div>
                <h2 className="text-2xl font-black text-charcoal dark:text-white uppercase tracking-tighter italic leading-none">
                  {modalAction === "ACCEPTED" ? "Approve" : "Reject"}{" "}
                  Engagement.
                </h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                  Final Authorization Protocol
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">
                  Strategy Note
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder={
                    modalAction === "REJECTED"
                      ? "Policy failure documentation required..."
                      : "Optional internal guidance..."
                  }
                  className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-white/5 rounded-3xl p-6 text-sm font-bold text-charcoal dark:text-white focus:ring-2 focus:ring-primary/20 transition-all min-h-[160px] resize-none outline-none"
                />
              </div>

              <button
                onClick={submitEventAction}
                disabled={
                  isProcessingEvent !== null ||
                  (modalAction === "REJECTED" && !feedback.trim())
                }
                className={clsx(
                  "w-full py-6 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] text-white transition-all shadow-2xl active:scale-95 disabled:opacity-50",
                  modalAction === "ACCEPTED"
                    ? "bg-emerald-500 shadow-emerald-500/30"
                    : "bg-red-500 shadow-red-500/30",
                )}
              >
                {isProcessingEvent ? (
                  <Loader2 className="animate-spin mx-auto" />
                ) : (
                  "Execute Decision"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedCalendarDate && (
        <div
          className="fixed inset-0 bg-charcoal/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-fade-in"
          onClick={() => setSelectedCalendarDate(null)}
        >
          <div
            className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[3rem] p-10 border border-white/10 relative animate-scale-in shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                <CalendarIcon size={24} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-charcoal dark:text-white uppercase tracking-tighter italic leading-none">
                  Day Manifest.
                </h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                  {selectedCalendarDate.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>

            <div className="space-y-4 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2">
              {calendarModalEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="p-6 rounded-[2rem] bg-slate-50 dark:bg-black border border-slate-100 dark:border-white/5 group hover:border-primary/50 transition-all"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[9px] font-black text-primary uppercase tracking-widest">
                      {ev.eventTime}
                    </span>
                    <ArrowRight
                      size={14}
                      className="text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
                    />
                  </div>
                  <h4 className="text-sm font-black text-charcoal dark:text-white uppercase tracking-tight">
                    {ev.eventType}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 mb-3">
                    {ev.user?.name || "Authorized Client"}
                  </p>

                  {ev.message && (
                    <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-white/5">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                        <MessageSquare size={10} /> Context
                      </p>
                      <p className="text-[11px] text-charcoal dark:text-white/80 leading-relaxed italic line-clamp-3">
                        "{ev.message}"
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => setSelectedCalendarDate(null)}
              className="w-full mt-8 py-4 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all"
            >
              Close View
            </button>
          </div>
        </div>
      )}

      {/* Styled Components - Persistence */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(var(--primary-rgb), 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(var(--primary-rgb), 0.3);
        }
      `}</style>
    </div>
  );
}
