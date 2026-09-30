"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  ShieldCheck,
  Loader2,
  Mail,
  Store,
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
} from "lucide-react";
import { toast } from "sonner";
import { FixUserRolesBanner } from "@/components/admin/fix-user-roles-banner";
import { ReviewsModeration } from "@/components/admin/reviews-moderation";
import { useAuth } from "@/app/providers";
import clsx from "clsx";
import { TenantHistory } from "@/components/admin/tenant-history";

export default function UserManagement() {
  const [activeTab, setActiveTab] = useState<"users" | "feedback" | "history">("users");
  const [pastTenants, setPastTenants] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const { user: currentUser } = useAuth();
  // Needs review + flagged, reported by <ReviewsModeration> for the tab badge.
  const [reviewAttention, setReviewAttention] = useState(0);
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

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (activeTab === "history") {
      loadHistory();
    }
  }, [activeTab]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const { getPastTenantsAction } = await import("@/app/actions/tenant");
      const res = await getPastTenantsAction();
      if (res.success && res.data) {
        setPastTenants(res.data);
      }
    } catch (err) {
      toast.error("Failed to load tenant history.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleToggleBlacklist = async (id: string, currentStatus: boolean) => {
    if (
      !confirm(
        `Authorization Override: Are you sure you want to ${currentStatus ? "Restore" : "Revoke"} access for this entity?`,
      )
    )
      return;
    setIsProcessing(id);
    const { toggleUserBlacklistAction } = await import("@/app/actions/auth");
    const res = await toggleUserBlacklistAction(id, !currentStatus, currentUser?.id);
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
      toast.error((res as any).error || "Couldn't update the account.");
    }
    setIsProcessing(null);
  };


  const handleRoleChange = async (id: string, newRole: string) => {
    setIsProcessing(id);
    const { updateUserRoleAction } = await import("@/app/actions/auth");
    const res = await updateUserRoleAction(id, newRole, currentUser?.id);
    if (res.success) {
      toast.success(`Privilege Matrix Updated to: ${newRole}`);
      setUsers(users.map((u) => (u.id === id ? { ...u, role: newRole } : u)));
    } else {
      toast.error((res as any).error || "Couldn't change the role.");
    }
    setIsProcessing(null);
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || u.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole =
      roleFilter === "ALL" ||
      (roleFilter === "BLACKLISTED" ? u.isBlacklisted : u.role === roleFilter);
    return matchesSearch && matchesRole;
  });


  return (
    <div className="p-4 md:p-8 lg:p-10 animate-fade-in-up space-y-10 min-h-screen max-w-[1700px] mx-auto">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-8 border-b border-slate-200 dark:border-white/10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/20">
            <Shield size={12} /> User Administration
          </div>
          <h1 className="text-5xl font-black text-charcoal dark:text-white tracking-tighter italic uppercase leading-none">
            User <span className="text-primary">Management.</span>
          </h1>
          <p className="text-slate-500 font-medium max-w-2xl text-lg">
            Manage registered users, update roles and permissions, and review customer feedback.
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

      <FixUserRolesBanner onFixed={loadUsers} />

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
            Users
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
            Feedback & Reviews
          </span>
          {reviewAttention > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-amber-500/10 text-amber-600 rounded-full text-[9px] font-bold">
              {reviewAttention}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={clsx(
            "flex items-center gap-3 px-8 py-4 rounded-2xl transition-all relative whitespace-nowrap active:scale-95",
            activeTab === "history"
              ? "bg-white dark:bg-zinc-800 text-charcoal dark:text-white shadow-xl"
              : "text-slate-400 hover:bg-white/50 dark:hover:bg-white/5",
          )}
        >
          <Store size={18} />
          <span className="text-[11px] font-black uppercase tracking-widest">
            Tenant History
          </span>
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
                  {["ALL", "CUSTOMER", "TENANT", "ADMIN", "BLACKLISTED"].map((role) => (
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
                    Loading Users...
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-white/[0.02]">
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        User Details
                      </th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Role & Permissions
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
                                  : "Suspend"}
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
        <ReviewsModeration adminId={currentUser?.id} onAttentionCount={setReviewAttention} />
      )}

      {activeTab === "history" && (
        <div className="animate-fade-in">
          <TenantHistory rows={pastTenants} loading={loadingHistory} />
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
