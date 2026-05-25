"use client";

import { useEffect, useState } from "react";
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
  ChevronDown,
} from "lucide-react";
import clsx from "clsx";
import {
  getPendingTenantsAction,
  approveTenantAction,
  rejectTenantAction,
} from "@/app/actions/tenant";
import { getAreaSlots } from "@/app/actions/space-slot";
import { toast } from "sonner";

export default function MerchantRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isApproving, setIsApproving] = useState<string | null>(null);
  const [selectedUnits, setSelectedUnits] = useState<Record<string, string>>(
    {},
  );
  const [openSelectId, setOpenSelectId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    const [reqRes, slotRes] = await Promise.all([
      getPendingTenantsAction(),
      getAreaSlots(),
    ]);

    if (reqRes.success) setRequests(reqRes.data || []);
    if (slotRes.success)
      setAvailableSlots(
        slotRes.data?.filter((s: any) => s.status === "AVAILABLE") || [],
      );
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (tenantId: string) => {
    const unitId = selectedUnits[tenantId];

    if (
      !unitId &&
      !confirm(
        "No Unit Assigned: This merchant will be approved without a physical unit assigned. Proceed?",
      )
    ) {
      return;
    }

    try {
      setIsApproving(tenantId);
      const res = await approveTenantAction(tenantId, unitId);
      if (res.success) {
        toast.success("Merchant Approved", {
          description:
            "User has been upgraded to Tenant status and Unit assigned.",
        });
        loadData();
      } else {
        toast.error("Approval Failed", { description: res.error });
      }
    } catch (err) {
      toast.error("Error approving merchant");
    } finally {
      setIsApproving(null);
    }
  };

  const handleReject = async (tenantId: string) => {
    if (
      confirm(
        "Are you sure you want to reject this merchant application? The user will be notified and won't be able to reapply.",
      )
    ) {
      const res = await rejectTenantAction(tenantId);
      if (res.success) {
        toast.warning("Merchant Application Rejected");
        loadData();
      } else {
        toast.error("Rejection Failed", { description: res.error });
      }
    }
  };

  return (
    <div className="p-10 animate-fade-in-up">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-black text-charcoal dark:text-white tracking-tight italic uppercase">
            Merchant <span className="text-primary">Partnerships</span>
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Review and board new digital storefront partners.
          </p>
        </div>
        <div className="flex items-center gap-4 px-6 py-3 bg-primary/5 border border-primary/10 rounded-2xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary">
            Pending Applications
          </p>
          <span className="text-2xl font-black text-primary">
            {requests.length}
          </span>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-[3rem] border border-slate-100 dark:border-white/5 shadow-2xl">
        <div className="w-full">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Applicant Details
                </th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Shop Description
                </th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Unit Assignment
                </th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">
                  Decision
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="py-20 text-center">
                    <Loader2
                      className="animate-spin mx-auto text-primary"
                      size={40}
                    />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-4">
                      Reviewing Applications...
                    </p>
                  </td>
                </tr>
              ) : requests.length > 0 ? (
                requests.map((req) => (
                  <tr
                    key={req.id}
                    className="hover:bg-slate-50 dark:hover:bg-white/5 transition-all group"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                          <User size={22} />
                        </div>
                        <div>
                          <p className="text-lg font-black text-charcoal dark:text-white leading-none">
                            {req.user?.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Mail size={10} className="text-slate-400" />
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none">
                              {req.user?.email}
                            </p>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 max-w-xs">
                      <div className="space-y-1">
                        <p className="text-xs font-black text-charcoal dark:text-white uppercase tracking-wider">
                          {req.shopName}
                        </p>
                        <p className="text-[11px] text-slate-500 font-medium line-clamp-2 leading-relaxed">
                          {req.description}
                        </p>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="relative flex items-center gap-2 group/select min-w-[200px]">
                        <MapPin
                          size={16}
                          className="text-slate-400 group-focus-within/select:text-primary transition-colors"
                        />
                        <div className="relative w-full">
                          <button
                            type="button"
                            onClick={() => setOpenSelectId(openSelectId === req.id ? null : req.id)}
                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-charcoal dark:text-white flex items-center justify-between transition-all outline-none focus:border-primary hover:bg-slate-100 dark:hover:bg-white/10"
                          >
                            <span>
                              {selectedUnits[req.id]
                                ? `Unit ${selectedUnits[req.id]}`
                                : "Select Available Unit"}
                            </span>
                            <ChevronDown size={14} className="text-slate-400" />
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
                                    {slot.unit_id} ({slot.sqm_size}m²)
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <button
                          onClick={() => handleApprove(req.id)}
                          disabled={isApproving === req.id}
                          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/30 active:scale-95 disabled:opacity-50"
                        >
                          {isApproving === req.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={14} />
                          )}{" "}
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(req.id)}
                          className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-500 hover:text-primary rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                        >
                          <XCircle size={14} /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-20 text-center">
                    <div className="w-16 h-16 rounded-3xl bg-slate-50 dark:bg-white/5 flex items-center justify-center mx-auto text-slate-300 mb-4">
                      <Store size={32} />
                    </div>
                    <p className="text-lg font-black text-charcoal dark:text-white">
                      All Requests Finalized
                    </p>
                    <p className="text-sm text-slate-500 font-medium">
                      There are no pending merchant applications at this time.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
