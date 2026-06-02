"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  ShieldCheck,
  Loader2,
  Mail,
  ShieldAlert,
  Store,
  Check,
  Trash2,
  Ban,
  CheckCircle2,
  Search,
  Filter,
  Activity,
  ArrowRight,
  UserPlus,
  Shield,
  MessageSquare,
  Sparkles,
  RefreshCcw,
  MoreHorizontal,
  X,
  Star,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";

export default function UserManagement() {
  const [activeTab, setActiveTab] = useState<"users" | "feedback">("users");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { getAllUsersAction } = await import("@/app/actions/auth");
      const result = await getAllUsersAction();
      if (result.success && result.data) {
        setUsers(result.data);
      }
    } catch (err) {
      toast.error("Institutional directory sync failed.");
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async () => {
    setReviewsLoading(true);
    try {
      const { getAllReviewsAction } = await import("@/app/actions/review");
      const res = await getAllReviewsAction();
      if (res.success && res.data) {
        setReviews(res.data);
      }
    } catch (err) {
      toast.error("Sentiment ledger sync failed.");
    } finally {
      setReviewsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (activeTab === "feedback") {
      loadReviews();
    }
  }, [activeTab]);

  const handleToggleBlacklist = async (id: string, currentStatus: boolean) => {
    if (
      !confirm(
        `Authorization Override: Are you sure you want to ${currentStatus ? "Restore" : "Revoke"} access for this entity?`,
      )
    )
      return;
    setIsProcessing(id);
    const { toggleUserBlacklistAction } = await import("@/app/actions/auth");
    const res = await toggleUserBlacklistAction(id, !currentStatus);
    if (res.success) {
      toast.success(
        `Entity ${!currentStatus ? "Restricted" : "Restored"} Successfully`,
      );
      setUsers(
        users.map((u) =>
          u.id === id ? { ...u, isBlacklisted: !currentStatus } : u,
        ),
      );
    } else {
      toast.error("Administrative Override Failed");
    }
    setIsProcessing(null);
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Critical Purge: This will permanently delete this identity and all associated manifests. Proceed?",
      )
    )
      return;
    setIsProcessing(id);
    const { deleteUserAction } = await import("@/app/actions/auth");
    const res = await deleteUserAction(id);
    if (res.success) {
      toast.warning("Identity Purged from Database");
      setUsers(users.filter((u) => u.id !== id));
    } else {
      toast.error("Purge Protocol Failure");
    }
    setIsProcessing(null);
  };

  const handleRoleChange = async (id: string, newRole: string) => {
    setIsProcessing(id);
    const { updateUserRoleAction } = await import("@/app/actions/auth");
    const res = await updateUserRoleAction(id, newRole);
    if (res.success) {
      toast.success(`Privilege Matrix Updated to: ${newRole}`);
      setUsers(users.map((u) => (u.id === id ? { ...u, role: newRole } : u)));
    } else {
      toast.error("Privilege Update Denied");
    }
    setIsProcessing(null);
  };

  const handleApproveReview = async (id: string) => {
    setIsProcessing(id);
    const { approveReviewAction } = await import("@/app/actions/review");
    const res = await approveReviewAction(id);
    if (res.success) {
      toast.success("Sentiment Approved for Public Manifest");
      setReviews(
        reviews.map((r) => (r.id === id ? { ...r, isApproved: true } : r)),
      );
    } else {
      toast.error("Moderation Sync Failure");
    }
    setIsProcessing(null);
  };

  const handleDeleteReview = async (id: string) => {
    if (!confirm("Moderation Filter: Purge this feedback from ledger?")) return;
    setIsProcessing(id);
    const { deleteReviewAction } = await import("@/app/actions/review");
    const res = await deleteReviewAction(id);
    if (res.success) {
      toast.warning("Sentiment Purged");
      setReviews(reviews.filter((r) => r.id !== id));
    } else {
      toast.error("Purge Protocol Failure");
    }
    setIsProcessing(null);
  };

  const handleSetCommentStatus = async (
    userId: string,
    status: "ACTIVE" | "MUTED" | "RESTRICTED" | "BANNED",
    days?: number
  ) => {
    setIsProcessing(userId);
    try {
      const { setCommentStatusAction } = await import("@/app/actions/review");
      const res = await setCommentStatusAction(userId, status, days);
      if (res.success) {
        toast.success(`User comment status updated to: ${status}`);
        loadReviews();
        loadUsers();
      } else {
        toast.error("Failed to update status: " + res.error);
      }
    } catch (err: any) {
      toast.error("Error updating comment status: " + err.message);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleToggleSpam = async (reviewId: string, currentSpamStatus: boolean) => {
    setIsProcessing(reviewId);
    try {
      const { markReviewSpamAction } = await import("@/app/actions/review");
      const res = await markReviewSpamAction(reviewId, !currentSpamStatus);
      if (res.success) {
        toast.success(`Review ${!currentSpamStatus ? "marked as spam" : "unmarked as spam"}`);
        loadReviews();
      } else {
        toast.error("Failed to update spam status");
      }
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setIsProcessing(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || u.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const blacklistedUsers = users.filter((u) => u.isBlacklisted);

  return (
    <div className="p-4 md:p-8 lg:p-10 animate-fade-in-up space-y-10 min-h-screen max-w-[1700px] mx-auto">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-8 border-b border-slate-200 dark:border-white/10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/20">
            <Shield size={12} /> Institutional Integrity Console
          </div>
          <h1 className="text-5xl font-black text-charcoal dark:text-white tracking-tighter italic uppercase leading-none">
            Governance <span className="text-primary">Console.</span>
          </h1>
          <p className="text-slate-500 font-medium max-w-2xl text-lg">
            Manage the master user matrix, privilege escalation, and coordinate
            sentiment moderation for the ecosystem.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={loadUsers}
            className="p-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-2xl text-slate-400 hover:text-primary transition-all shadow-sm active:scale-95"
          >
            <RefreshCcw size={20} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Navigation Matrix */}
      <div className="flex items-center gap-2 bg-slate-100/50 dark:bg-white/5 p-2 rounded-[2rem] w-fit border border-slate-200 dark:border-white/5">
        <button
          onClick={() => setActiveTab("users")}
          className={clsx(
            "flex items-center gap-3 px-8 py-4 rounded-2xl transition-all relative whitespace-nowrap active:scale-95",
            activeTab === "users"
              ? "bg-white dark:bg-zinc-800 text-charcoal dark:text-white shadow-xl"
              : "text-slate-400 hover:bg-white/50 dark:hover:bg-white/5",
          )}
        >
          <Users size={18} />
          <span className="text-[11px] font-black uppercase tracking-widest">
            Identity Matrix
          </span>
          {users.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[9px] font-bold">
              {users.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("feedback")}
          className={clsx(
            "flex items-center gap-3 px-8 py-4 rounded-2xl transition-all relative whitespace-nowrap active:scale-95",
            activeTab === "feedback"
              ? "bg-white dark:bg-zinc-800 text-charcoal dark:text-white shadow-xl"
              : "text-slate-400 hover:bg-white/50 dark:hover:bg-white/5",
          )}
        >
          <MessageSquare size={18} />
          <span className="text-[11px] font-black uppercase tracking-widest">
            Sentiment Ledger
          </span>
          {reviews.filter((r) => !r.isApproved || r.isSpam).length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-amber-500/10 text-amber-600 rounded-full text-[9px] font-bold">
              {reviews.filter((r) => !r.isApproved || r.isSpam).length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "users" && (
        <div className="space-y-8 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-[3rem] shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100 dark:border-white/5 bg-slate-50/30 dark:bg-white/[0.02] flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-primary/10 rounded-[1.25rem] flex items-center justify-center text-primary shadow-inner">
                  <ShieldCheck size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-charcoal dark:text-white uppercase tracking-tighter italic">
                    Global Directory
                  </h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                    Institutional Integrity: 100% Operational
                  </p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                {/* Role Filter */}
                <div className="flex items-center gap-1 p-1 bg-slate-100/50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/5 w-full md:w-auto overflow-x-auto custom-scrollbar">
                  {["ALL", "CUSTOMER", "TENANT", "ADMIN"].map((role) => (
                    <button
                      key={role}
                      onClick={() => setRoleFilter(role)}
                      className={clsx(
                        "px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                        roleFilter === role
                          ? "bg-white dark:bg-zinc-800 text-charcoal dark:text-white shadow-sm"
                          : "text-slate-400 hover:text-charcoal dark:hover:text-white"
                      )}
                    >
                      {role}
                    </button>
                  ))}
                </div>

                {/* Search Bar */}
                <div className="relative group/search w-full md:w-auto" onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}>
                  <Search
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/search:text-primary transition-colors z-10"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    placeholder="FILTER IDENTITY..."
                    className="pl-12 pr-6 py-4 bg-white dark:bg-black border border-slate-200 dark:border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest w-full md:w-72 focus:ring-4 focus:ring-primary/10 transition-all outline-none relative z-10"
                  />

                  {/* Recommended Matches Dropdown */}
                  {isSearchFocused && searchQuery.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-fade-in-up">
                      <div className="p-3 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Recommended Matches</p>
                      </div>
                      <div className="max-h-60 overflow-y-auto custom-scrollbar">
                        {filteredUsers.slice(0, 5).length === 0 ? (
                          <div className="p-4 text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Matches Found</p>
                          </div>
                        ) : (
                          filteredUsers.slice(0, 5).map((u) => (
                            <div
                              key={u.id}
                              className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.02] cursor-pointer flex items-center gap-3 transition-colors border-b border-slate-50 dark:border-white/5 last:border-0"
                              onClick={() => {
                                setSelectedUser(u);
                                setSearchQuery("");
                                setIsSearchFocused(false);
                              }}
                            >
                              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs shrink-0">
                                {u.name ? u.name.charAt(0).toUpperCase() : "U"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-black uppercase text-charcoal dark:text-white truncate">{u.name || "ANONYMOUS"}</p>
                                <p className="text-[9px] font-bold text-slate-400 truncate">{u.email}</p>
                              </div>
                              <div className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded-full text-[8px] font-black uppercase text-slate-500 shrink-0">
                                {u.role}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              {loading ? (
                <div className="py-40 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                    Syncing Matrix...
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-white/[0.02]">
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Institutional Identity
                      </th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Privilege Level
                      </th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Security Status
                      </th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">
                        Administrative Protocol
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-8 py-20 text-center">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                            No identities matched the filter criteria.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors group/row"
                        >
                          <td
                            className="px-8 py-8 cursor-pointer"
                            onClick={() => setSelectedUser(item)}
                          >
                            <div className="flex items-center gap-5">
                              <div
                                className={clsx(
                                  "w-14 h-14 rounded-[1.5rem] font-black text-lg flex items-center justify-center border transition-all shadow-sm",
                                  item.isBlacklisted
                                    ? "bg-red-500 text-white border-red-400"
                                    : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 border-transparent",
                                )}
                              >
                                {item.name
                                  ? item.name.charAt(0).toUpperCase()
                                  : "U"}
                              </div>
                              <div>
                                <p
                                  className={clsx(
                                    "text-base font-black uppercase tracking-tight italic",
                                    item.isBlacklisted
                                      ? "text-red-500 line-through opacity-60"
                                      : "text-charcoal dark:text-white",
                                  )}
                                >
                                  {item.name || "ANONYMOUS"}
                                </p>
                                <p className="text-[10px] font-bold text-slate-400 mt-0.5 tracking-wider">
                                  {item.email}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-8">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-primary/10 text-primary rounded-xl">
                                <Shield size={16} />
                              </div>
                              <select
                                value={item.role}
                                onChange={(e) =>
                                  handleRoleChange(item.id, e.target.value)
                                }
                                disabled={isProcessing === item.id}
                                className="bg-transparent text-[11px] font-black uppercase tracking-widest text-charcoal dark:text-white hover:text-primary transition-colors cursor-pointer outline-none border-none p-0 focus:ring-0"
                              >
                                <option value="CUSTOMER" className="bg-white dark:bg-zinc-900 text-charcoal dark:text-white">Customer Segment</option>
                                <option value="TENANT" className="bg-white dark:bg-zinc-900 text-charcoal dark:text-white">Merchant Partner</option>
                                <option value="ADMIN" className="bg-white dark:bg-zinc-900 text-charcoal dark:text-white">System Admin</option>
                              </select>
                              {isProcessing === item.id && (
                                <Loader2
                                  size={14}
                                  className="animate-spin text-primary"
                                />
                              )}
                            </div>
                          </td>
                          <td className="px-8 py-8">
                            {item.isBlacklisted ? (
                              <span className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 text-red-500 text-[9px] font-black uppercase tracking-widest rounded-full border border-red-500/20">
                                <Ban size={10} /> Blacklisted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase tracking-widest rounded-full border border-emerald-500/20">
                                <Activity size={10} className="animate-pulse" />{" "}
                                Active Uplink
                              </span>
                            )}
                          </td>
                          <td className="px-8 py-8 text-right">
                            <div className="flex items-center justify-end gap-3 opacity-0 group-hover/row:opacity-100 transition-all duration-300">
                              <button
                                onClick={() =>
                                  handleToggleBlacklist(
                                    item.id,
                                    item.isBlacklisted,
                                  )
                                }
                                disabled={isProcessing === item.id}
                                className={clsx(
                                  "px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 disabled:opacity-50",
                                  item.isBlacklisted
                                    ? "bg-emerald-500 text-white shadow-emerald-500/20"
                                    : "bg-red-500 text-white shadow-red-500/20",
                                )}
                              >
                                {item.isBlacklisted
                                  ? "Restore Access"
                                  : "Revoke Authorization"}
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                disabled={isProcessing === item.id}
                                className="p-3.5 bg-slate-100 dark:bg-zinc-800 text-slate-400 hover:text-red-500 rounded-xl transition-all"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "feedback" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 animate-fade-in">
          {/* Left: Moderation Feed */}
          <div className="xl:col-span-8 space-y-12">
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-charcoal dark:text-white uppercase item-center italic tracking-tighter">
                  Sentiment <span className="text-primary">Moderation.</span>
                </h2>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {reviews.filter((r) => r.isApproved).length} Approved Manifests
                </span>
              </div>

              <div className="space-y-6">
                {reviewsLoading ? (
                  <div className="p-40 text-center">
                    <Loader2
                      className="animate-spin mx-auto text-primary"
                      size={40}
                    />
                  </div>
                ) : reviews.filter((r) => r.isApproved).length === 0 ? (
                  <div className="p-20 text-center border-2 border-dashed border-slate-200 dark:border-white/5 rounded-[3rem] bg-white/50 dark:bg-zinc-900/50">
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                      No Approved Sentiment Manifests
                    </p>
                  </div>
                ) : (
                  reviews.filter((r) => r.isApproved).map((item: any) => (
                    <div
                      key={item.id}
                      className={clsx(
                        "p-10 rounded-[3rem] border transition-all group/review relative overflow-hidden",
                        item.isSpam
                          ? "bg-red-500/5 border-red-500/20"
                          : "bg-white dark:bg-zinc-900 border-slate-100 dark:border-white/5",
                      )}
                    >
                      <div className="flex flex-col md:flex-row items-start justify-between gap-10 relative z-10">
                        <div className="flex-1 space-y-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center font-black text-primary">
                              {item.user?.name?.charAt(0) || "U"}
                            </div>
                            <div>
                              <div className="flex items-center gap-3">
                                <h4 className="text-sm font-black text-charcoal dark:text-white uppercase">
                                  {item.user?.name || "Authorized Shopper"}
                                </h4>
                                <div className="flex items-center gap-1">
                                  {[...Array(5)].map((_, i) => (
                                    <Star
                                      key={i}
                                      size={10}
                                      className={clsx(
                                        i < (item.rating || 5)
                                          ? "fill-amber-500 text-amber-500"
                                          : "text-slate-200",
                                      )}
                                    />
                                  ))}
                                </div>
                                {item.isSpam && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg text-[8px] font-black uppercase tracking-wider animate-pulse">
                                    <AlertTriangle size={10} /> Auto-Detected Spam
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                {new Date(item.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="p-6 bg-slate-50/50 dark:bg-black/40 rounded-[2rem] border border-slate-100/50 dark:border-white/5 relative">
                            <MessageSquare
                              size={40}
                              className="absolute -top-5 -right-5 text-primary opacity-5"
                            />
                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 italic leading-relaxed">
                              "{item.comment}"
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-4 pt-2">
                            <button
                              onClick={() => handleToggleSpam(item.id, item.isSpam)}
                              className={clsx(
                                "px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                item.isSpam
                                  ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20"
                                  : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200"
                              )}
                            >
                              {item.isSpam ? "Mark as Legitimate" : "Flag as Spam"}
                            </button>
                            <button
                              onClick={() => handleDeleteReview(item.id)}
                              className="px-6 py-3 bg-red-500/10 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
                            >
                              Purge Sentiment
                            </button>
                          </div>

                          {item.user && (
                            <div className="pt-6 border-t border-slate-100 dark:border-white/5 space-y-4">
                              <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    User Account Status:
                                  </span>
                                  <span className={clsx(
                                    "px-2.5 py-1 text-[9px] font-black rounded-lg uppercase tracking-wider border",
                                    (!item.user.commentStatus || item.user.commentStatus === "ACTIVE") && "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                                    item.user.commentStatus === "MUTED" && "bg-amber-500/10 text-amber-500 border-amber-500/20",
                                    item.user.commentStatus === "RESTRICTED" && "bg-orange-500/10 text-orange-500 border-orange-500/20",
                                    item.user.commentStatus === "BANNED" && "bg-red-500/10 text-red-500 border-red-500/20"
                                  )}>
                                    {item.user.commentStatus || "ACTIVE"}
                                    {item.user.commentRestrictedUntil && new Date(item.user.commentRestrictedUntil) > new Date() && (
                                      ` (Restricted until ${new Date(item.user.commentRestrictedUntil).toLocaleDateString()})`
                                    )}
                                  </span>
                                </div>
                              </div>

                              {/* Admin violation controls */}
                              <div className="bg-slate-50/50 dark:bg-black/20 p-5 rounded-3xl border border-slate-100 dark:border-white/5 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Duration selection:
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {[
                                      { label: "1 Day", days: 1 },
                                      { label: "3 Days", days: 3 },
                                      { label: "1 Week", days: 7 },
                                      { label: "2 Weeks", days: 14 },
                                      { label: "Permanent", days: 0 }
                                    ].map((d) => (
                                      <button
                                        key={d.label}
                                        id={`dur-${item.id}-${d.days}`}
                                        onClick={() => {
                                          // Update active tab style inside this duration selector
                                          const values = [1, 3, 7, 14, 0];
                                          values.forEach(val => {
                                            const el = document.getElementById(`dur-${item.id}-${val}`);
                                            if (el) {
                                              if (val === d.days) {
                                                el.classList.remove("bg-white", "dark:bg-zinc-800", "text-slate-500");
                                                el.classList.add("bg-primary", "text-white");
                                              } else {
                                                el.classList.add("bg-white", "dark:bg-zinc-800", "text-slate-500");
                                                el.classList.remove("bg-primary", "text-white");
                                              }
                                            }
                                          });
                                        }}
                                        className={clsx(
                                          "px-2.5 py-1 text-[8px] font-black uppercase tracking-wider rounded-md transition-all border border-slate-100 dark:border-white/5 shadow-sm",
                                          d.days === 7 ? "bg-primary text-white" : "bg-white dark:bg-zinc-800 text-slate-500"
                                        )}
                                      >
                                        {d.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-white/5 pt-3">
                                  <button
                                    onClick={() => {
                                      const values = [1, 3, 7, 14, 0];
                                      const activeDays = values.find(val => 
                                        document.getElementById(`dur-${item.id}-${val}`)?.classList.contains("bg-primary")
                                      ) ?? 7;
                                      handleSetCommentStatus(item.user.id, "MUTED", activeDays);
                                    }}
                                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all"
                                  >
                                    Cannot Comment (Mute)
                                  </button>
                                  <button
                                    onClick={() => {
                                      const values = [1, 3, 7, 14, 0];
                                      const activeDays = values.find(val => 
                                        document.getElementById(`dur-${item.id}-${val}`)?.classList.contains("bg-primary")
                                      ) ?? 7;
                                      handleSetCommentStatus(item.user.id, "RESTRICTED", activeDays);
                                    }}
                                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all"
                                  >
                                    Temporary Restriction
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleSetCommentStatus(item.user.id, "BANNED", 0);
                                    }}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all"
                                  >
                                    Block or Ban
                                  </button>
                                  {item.user.commentStatus && item.user.commentStatus !== "ACTIVE" && (
                                    <button
                                      onClick={() => handleSetCommentStatus(item.user.id, "ACTIVE")}
                                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ml-auto border border-emerald-500/20"
                                    >
                                      Restore / Unrestrict
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="shrink-0 text-right opacity-40 group-hover/review:opacity-100 transition-opacity">
                          <div className="bg-slate-100 dark:bg-zinc-800 p-4 rounded-2xl flex flex-col items-center">
                            <span className="text-2xl font-black text-charcoal dark:text-white">
                              {item.rating || 5}
                            </span>
                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                              Stars
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* DOWN of Sentiment Moderation: Spam Quarantine */}
            <div className="space-y-8 pt-12 border-t border-slate-200 dark:border-white/5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-charcoal dark:text-white uppercase item-center italic tracking-tighter">
                    Spam <span className="text-amber-500">Quarantine.</span>
                  </h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Auto-flagged sentiments waiting for admin review
                  </p>
                </div>
                <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider">
                  {reviews.filter((r) => !r.isApproved || r.isSpam).length} Suspicious
                </span>
              </div>

              <div className="space-y-6">
                {reviewsLoading ? (
                  <div className="p-40 text-center">
                    <Loader2
                      className="animate-spin mx-auto text-primary"
                      size={40}
                    />
                  </div>
                ) : reviews.filter((r) => !r.isApproved || r.isSpam).length === 0 ? (
                  <div className="p-20 text-center border-2 border-dashed border-slate-200 dark:border-white/5 rounded-[3rem] bg-white/50 dark:bg-zinc-900/50">
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                      Ledger is Clear: No suspicious activity detected
                    </p>
                  </div>
                ) : (
                  reviews.filter((r) => !r.isApproved || r.isSpam).map((item: any) => (
                    <div
                      key={item.id}
                      className="p-10 rounded-[3rem] border transition-all group/review relative overflow-hidden bg-amber-500/5 border-amber-500/20"
                    >
                      <div className="flex flex-col md:flex-row items-start justify-between gap-10 relative z-10">
                        <div className="flex-1 space-y-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center font-black text-primary">
                              {item.user?.name?.charAt(0) || "U"}
                            </div>
                            <div>
                              <div className="flex items-center gap-3">
                                <h4 className="text-sm font-black text-charcoal dark:text-white uppercase">
                                  {item.user?.name || "Authorized Shopper"}
                                </h4>
                                <div className="flex items-center gap-1">
                                  {[...Array(5)].map((_, i) => (
                                    <Star
                                      key={i}
                                      size={10}
                                      className={clsx(
                                        i < (item.rating || 5)
                                          ? "fill-amber-500 text-amber-500"
                                          : "text-slate-200",
                                      )}
                                    />
                                  ))}
                                </div>
                              </div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                {new Date(item.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="p-6 bg-slate-50/50 dark:bg-black/40 rounded-[2rem] border border-slate-100/50 dark:border-white/5 relative">
                            <MessageSquare
                              size={40}
                              className="absolute -top-5 -right-5 text-primary opacity-5"
                            />
                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 italic leading-relaxed">
                              "{item.comment}"
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-4 pt-2">
                            <button
                              onClick={() => handleApproveReview(item.id)}
                              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20"
                            >
                              Authorize Comment
                            </button>
                            <button
                              onClick={() => handleDeleteReview(item.id)}
                              className="px-6 py-3 bg-red-500/10 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
                            >
                              Reject & Purge
                            </button>
                          </div>
                        </div>

                        <div className="shrink-0 text-right opacity-40 group-hover/review:opacity-100 transition-opacity">
                          <div className="bg-slate-100 dark:bg-zinc-800 p-4 rounded-2xl flex flex-col items-center">
                            <span className="text-2xl font-black text-charcoal dark:text-white">
                              {item.rating || 5}
                            </span>
                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                              Stars
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right: Restricted Entities Terminal */}
          <div className="xl:col-span-4 space-y-8">
            <h2 className="text-2xl font-black text-charcoal dark:text-white uppercase italic tracking-tighter">
              Blacklist <span className="text-red-500">Terminal.</span>
            </h2>
            <div className="bg-charcoal dark:bg-zinc-900 rounded-[3rem] p-10 border border-white/5 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <ShieldAlert size={120} />
              </div>

              <div className="flex items-center justify-between mb-10 relative z-10">
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">
                    Restricted Node Matrix
                  </h3>
                  <p className="text-[10px] font-black text-red-500 uppercase tracking-widest underline decoration-red-500/30 decoration-4">
                    Authorization Denied
                  </p>
                </div>
                <div className="bg-red-500 text-white px-4 py-1 rounded-xl text-xs font-black shadow-lg shadow-red-500/20">
                  {blacklistedUsers.length}
                </div>
              </div>

              <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2 relative z-10">
                {blacklistedUsers.length === 0 ? (
                  <div className="py-20 text-center space-y-4">
                    <ShieldCheck
                      size={48}
                      className="text-emerald-500 mx-auto opacity-20"
                    />
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest animate-pulse">
                      Ecosystem Security Integrity: High
                    </p>
                  </div>
                ) : (
                  blacklistedUsers.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-5 bg-white/5 rounded-[1.5rem] border border-white/5 group/bitem hover:bg-white/10 hover:border-red-500/30 transition-all"
                    >
                      <div className="truncate flex-1">
                        <p className="text-sm font-black text-white truncate uppercase tracking-tight">
                          {u.name || "ANONYMOUS"}
                        </p>
                        <p className="text-[10px] text-zinc-500 font-bold truncate tracking-widest mt-0.5">
                          {u.email}
                        </p>
                      </div>
                      <button
                        onClick={() => handleToggleBlacklist(u.id, true)}
                        className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center opacity-0 group-hover/bitem:opacity-100 hover:scale-110 active:scale-95 transition-all"
                        title="Restore Identity"
                      >
                        <Check size={18} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-10 pt-8 border-t border-white/5 space-y-4 relative z-10">
                <p className="text-[9px] font-bold text-zinc-500 uppercase leading-relaxed tracking-wider italic">
                  Administrative Warning: Blacklisted entities are automatically
                  blocked from terminal authentication and manifesting. All
                  active session keys for these identifiers have been
                  liquidated.
                </p>
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="bg-primary rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:rotate-12 transition-transform">
                <RefreshCcw size={40} />
              </div>
              <h4 className="text-lg font-black uppercase italic tracking-tighter mb-2">
                Global Refresh
              </h4>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-6 underline decoration-white/20">
                Re-synchronize entire identity matrix.
              </p>
              <button
                onClick={loadUsers}
                className="w-full py-4 bg-white text-primary rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-black/10 active:scale-95 transition-all"
              >
                Execute Sync
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedUser(null)}>
          <div
            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
              <h3 className="text-xl font-black text-charcoal dark:text-white uppercase tracking-tighter italic">
                Entity <span className="text-primary">Manifest.</span>
              </h3>
              <button
                onClick={() => setSelectedUser(null)}
                className="w-10 h-10 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm"
              >
                <X size={16} strokeWidth={3} />
              </button>
            </div>

            <div className="p-8 space-y-8">
              <div className="flex items-center gap-6">
                <div className={clsx("w-20 h-20 rounded-[2rem] font-black text-3xl flex items-center justify-center border-4 shadow-xl transition-all",
                  selectedUser.isBlacklisted ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-primary/10 text-primary border-primary/20"
                )}>
                  {selectedUser.name ? selectedUser.name.charAt(0).toUpperCase() : "U"}
                </div>
                <div>
                  <h4 className={clsx("text-2xl font-black uppercase tracking-tight italic", selectedUser.isBlacklisted ? "text-red-500 line-through opacity-60" : "text-charcoal dark:text-white")}>
                    {selectedUser.name || "ANONYMOUS"}
                  </h4>
                  <p className="text-sm font-bold text-slate-400 tracking-wider mt-1">
                    {selectedUser.email}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-500 text-[9px] font-black uppercase tracking-widest rounded-full">
                      ID: {selectedUser.id}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 bg-slate-50 dark:bg-white/[0.02] rounded-3xl border border-slate-100 dark:border-white/5">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Shield size={10} /> Privilege Level</p>
                  <p className="text-sm font-black text-charcoal dark:text-white uppercase">{selectedUser.role}</p>
                </div>
                <div className="p-5 bg-slate-50 dark:bg-white/[0.02] rounded-3xl border border-slate-100 dark:border-white/5">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Activity size={10} /> Security Status</p>
                  <p className={clsx("text-sm font-black uppercase", selectedUser.isBlacklisted ? "text-red-500" : "text-emerald-500")}>
                    {selectedUser.isBlacklisted ? "Blacklisted" : "Active"}
                  </p>
                </div>
                <div className="p-5 bg-slate-50 dark:bg-white/[0.02] rounded-3xl border border-slate-100 dark:border-white/5">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Created At</p>
                  <p className="text-sm font-bold text-charcoal dark:text-white">
                    {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : "Unknown"}
                  </p>
                </div>
                <div className="p-5 bg-slate-50 dark:bg-white/[0.02] rounded-3xl border border-slate-100 dark:border-white/5">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Last Login</p>
                  <p className="text-sm font-bold text-charcoal dark:text-white">
                    {selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleDateString() : "N/A"}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 flex justify-end">
              <button onClick={() => setSelectedUser(null)} className="px-8 py-4 bg-charcoal dark:bg-white text-white dark:text-black rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all">
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistence Custom Styling */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
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
