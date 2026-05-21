"use client";

import React from "react";
import {
  Download,
  Receipt,
  Calendar,
  Building2,
  AlertTriangle,
  CheckCircle,
  Clock,
  X,
} from "lucide-react";
import { getTenantInvoices, submitDepositSlip } from "@/app/actions/finance";
import { getStorefrontAction } from "@/app/actions/tenant";
import { generateTenantReceiptPDF } from "@/utils/report-generator";
import { useAuth } from "@/app/providers";

export default function LeasePayments() {
  const { user } = useAuth();
  const [payments, setPayments] = React.useState<any[]>([]);
  const [uploadingFor, setUploadingFor] = React.useState<string | null>(null);
  const [storefront, setStorefront] = React.useState<any>(null);
  const [toast, setToast] = React.useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  React.useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (user?.id) {
      const fetchData = async () => {
        const res = await getStorefrontAction(user.id);
        if (res.success && res.data) {
          setStorefront(res.data);
          const data = await getTenantInvoices(res.data.id);
          setPayments(data || []);
        }
      };

      fetchData();
      // Simulate Supabase Realtime with high-frequency polling
      intervalId = setInterval(fetchData, 10000);
    }
    return () => clearInterval(intervalId);
  }, [user]);

  const unpaidBalance = payments
    .filter((p) => p.status === "PENDING" || p.status === "OVERDUE")
    .reduce((sum, p) => sum + p.amount, 0);
  const isCleared = payments.length > 0 && unpaidBalance === 0;

  // Derive contract info from storefront
  const unitId = storefront?.unit_id || "—";
  const isOccupied =
    unitId && unitId !== "PENDING_ASSIGNMENT" && unitId !== "—";

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    invoiceId: string,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFor(invoiceId);
    try {
      const { getCloudStorageProvider } = await import("@/lib/cloud-storage");
      const storageProvider = getCloudStorageProvider();
      const result = await storageProvider.uploadFile(file, "receipts");

      const res = await submitDepositSlip(invoiceId, result.url, result.key);
      if (res.success) {
        setPayments((prev) =>
          prev.map((p) =>
            p.id === invoiceId ? { ...p, status: "REVIEWING" } : p,
          ),
        );
        showToast(
          "Deposit slip submitted! Awaiting administrative clearance.",
          "success",
        );
      } else {
        showToast("Database sync failed: " + res.error, "error");
      }
    } catch (error: any) {
      console.error("Upload failed:", error);
      showToast("Failed to upload deposit slip. Please try again.", "error");
    } finally {
      setUploadingFor(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black pb-20 lg:pb-0">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-4 sm:right-8 z-[300] flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-4 font-bold text-sm rounded-2xl shadow-2xl animate-fade-in-up ${
            toast.type === "success"
              ? "bg-emerald-500 text-white shadow-emerald-500/30"
              : "bg-red-500 text-white shadow-red-500/30"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle size={16} />
          ) : (
            <AlertTriangle size={16} />
          )}
          <span className="text-xs sm:text-sm">{toast.msg}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-1 opacity-70 hover:opacity-100"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-10 space-y-4 sm:space-y-6 lg:space-y-8">
        {/* Header */}
        <div>
          <p className="text-[10px] sm:text-xs font-bold text-primary uppercase tracking-widest mb-1">
            Financial
          </p>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-charcoal dark:text-white tracking-tight">
            Lease &amp; Billing
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Submit your bank deposit slips to verify your monthly dues in the
            administration office.
          </p>
        </div>

        {/* Disclaimer Banner */}
        <div className="bg-amber-50 dark:bg-amber-900/10 border-2 border-dashed border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 sm:p-6 flex items-start sm:items-center gap-4">
          <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-full hidden sm:block">
            <AlertTriangle
              className="text-amber-600 dark:text-amber-500"
              size={24}
            />
          </div>
          <div>
            <h3 className="font-black text-amber-800 dark:text-amber-500 text-sm sm:text-base uppercase tracking-tight">
              Direct Online Payments Unavailable
            </h3>
            <p className="text-xs sm:text-sm text-amber-700/80 dark:text-amber-400/80 font-medium mt-1 leading-relaxed">
              Per mall administration policy, web-based checkout processing is
              disabled. Payments must be completed via direct{" "}
              <strong>Bank Transfer</strong> or{" "}
              <strong>Over-The-Counter Cash Deposit</strong>. Please upload your
              deposit slip or verified receipt for clearance here.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4 sm:mb-6">
              <h3 className="text-slate-500 font-bold text-[10px] uppercase tracking-widest leading-none">
                Account Standing
              </h3>
              <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-zinc-800 text-slate-500 flex items-center justify-center">
                <Receipt size={16} />
              </div>
            </div>
            <div>
              {isCleared ? (
                <div className="flex items-center gap-3">
                  <span className="text-4xl sm:text-5xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-900/30 w-16 h-16 flex items-center justify-center rounded-2xl shadow-inner shadow-emerald-500/20">
                    🟢
                  </span>
                  <div>
                    <p className="text-2xl sm:text-3xl font-black text-emerald-600">
                      Account Cleared
                    </p>
                    <p className="text-[10px] sm:text-xs font-bold text-emerald-500/60 uppercase tracking-widest mt-1">
                      No outstanding balances
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-4xl sm:text-5xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/30 w-16 h-16 flex items-center justify-center rounded-2xl shadow-inner shadow-red-500/20">
                    🔴
                  </span>
                  <div>
                    <p className="text-[10px] sm:text-xs font-black text-red-500/60 uppercase tracking-widest mb-1">
                      Balance Due
                    </p>
                    <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-charcoal dark:text-white">
                      ₱{unpaidBalance.toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Unit Assignment */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] shadow-sm flex flex-col justify-between relative overflow-hidden group">
            <div className="flex justify-between items-start mb-4 sm:mb-6 relative z-10">
              <div>
                <h3 className="text-slate-500 font-bold text-[10px] uppercase tracking-widest leading-none mb-1">
                  Unit Assignment
                </h3>
                <p className="text-lg sm:text-2xl font-black text-charcoal dark:text-white flex items-center gap-2">
                  {unitId}
                  {isOccupied && (
                    <span className="flex items-center gap-1 px-2 py-1 text-[9px] sm:text-[10px] bg-red-50 dark:bg-red-900/20 text-primary border border-primary rounded-full uppercase tracking-widest">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full" />{" "}
                      Occupied
                    </span>
                  )}
                  {!isOccupied && (
                    <span className="flex items-center gap-1 px-2 py-1 text-[9px] sm:text-[10px] bg-amber-50 dark:bg-amber-900/20 text-amber-600 border border-amber-400 rounded-full uppercase tracking-widest">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />{" "}
                      Pending
                    </span>
                  )}
                </p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-400 flex items-center justify-center">
                <Building2 size={18} className="sm:w-5 sm:h-5" />
              </div>
            </div>

            <div className="relative z-10">
              <div className="flex justify-between items-end mb-2">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Calendar size={12} /> Payment Progress
                </h4>
                <span className="text-sm font-black text-charcoal dark:text-white">
                  {payments.filter((p) => p.status === "PAID").length}/
                  {payments.length} Paid
                </span>
              </div>
              <div className="w-full h-3 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                  style={{
                    width:
                      payments.length > 0
                        ? `${(payments.filter((p) => p.status === "PAID").length / payments.length) * 100}%`
                        : "0%",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Payment Ledger Table */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-2xl sm:rounded-[2rem] shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-base sm:text-lg text-charcoal dark:text-white flex items-center gap-2">
                <Receipt
                  size={16}
                  className="text-slate-400 sm:w-[18px] sm:h-[18px]"
                />{" "}
                Billing Ledger
              </h2>
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                Submit Payment Proof &amp; Download Receipts
              </p>
            </div>
            {payments.length > 0 && (
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-black text-charcoal dark:text-white">
                  {payments.filter((p) => p.status === "PAID").length} /{" "}
                  {payments.length}
                </p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Invoices Cleared
                </p>
              </div>
            )}
          </div>

          <div className="overflow-x-auto p-2 sm:p-4">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                  <th className="px-4 sm:px-6 py-3 sm:py-4 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Billing Month
                  </th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Amount Due
                  </th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Status
                  </th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">
                    Proof of Remittance
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center">
                      <Receipt
                        size={32}
                        className="mx-auto text-slate-200 dark:text-zinc-700 mb-3"
                      />
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        No active billing obligations found
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Your invoices will appear here once the admin generates
                        them.
                      </p>
                    </td>
                  </tr>
                )}
                {payments.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group"
                  >
                    <td className="px-4 sm:px-6 py-4 sm:py-5">
                      <p className="font-bold text-charcoal dark:text-white text-xs sm:text-sm">
                        {row.month}
                      </p>
                      <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        {row.invoiceNumber}{row.status === "PAID" && ` • OR-${row.invoiceNumber.replace("#INV-", "").replace("#", "")}`}
                      </p>
                      <p className="text-[9px] sm:text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-white/5">
                        <Calendar size={10} />
                        Due:{" "}
                        {new Date(row.dueDate).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </td>
                    <td className="px-4 sm:px-6 py-4 sm:py-5 text-xs sm:text-sm font-black text-charcoal dark:text-white">
                      ₱
                      {row.amount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 sm:px-6 py-4 sm:py-5">
                      {row.status === "PAID" && (
                        <span className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest bg-green-50 text-green-600 rounded-lg border border-green-200">
                          <CheckCircle size={10} className="sm:w-3 sm:h-3" />{" "}
                          Cleared
                        </span>
                      )}
                      {row.status === "REVIEWING" && (
                        <span className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest bg-blue-50 text-blue-600 rounded-lg border border-blue-200 animate-pulse">
                          <Clock size={10} className="sm:w-3 sm:h-3" /> In
                          Review
                        </span>
                      )}
                      {row.status === "PENDING" && (
                        <span className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest bg-amber-50 text-amber-600 rounded-lg border border-amber-200">
                          <AlertTriangle size={10} className="sm:w-3 sm:h-3" />{" "}
                          Pending
                        </span>
                      )}
                      {row.status === "OVERDUE" && (
                        <span className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest bg-red-50 text-primary rounded-lg border border-red-200">
                          <AlertTriangle size={10} className="sm:w-3 sm:h-3" />{" "}
                          Overdue
                        </span>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-4 sm:py-5 text-right">
                      {row.status === "PAID" ? (
                        row.referenceNo ? (
                          <div className="inline-flex flex-col items-end gap-1 text-right">
                            <button
                              onClick={() =>
                                generateTenantReceiptPDF(row, storefront)
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all hover:scale-105 active:scale-95 shadow-sm shadow-emerald-500/10 cursor-pointer"
                            >
                              <Download size={10} /> Download receipt
                            </button>
                            <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                              Admin Ref: {row.referenceNo}
                            </p>
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              generateTenantReceiptPDF(row, storefront)
                            }
                            className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 hover:text-primary rounded-xl font-bold text-[9px] sm:text-[10px] uppercase tracking-widest transition-colors hover:scale-105 active:scale-95"
                          >
                            <Download
                              size={12}
                              className="sm:w-[14px] sm:h-[14px]"
                            />{" "}
                            Web Receipt
                          </button>
                        )
                      ) : row.status === "REVIEWING" ? (
                        <span className="inline-flex items-center px-3 sm:px-4 py-2 text-[9px] sm:text-[10px] font-bold text-blue-500 uppercase tracking-widest">
                          <Clock size={10} className="mr-1" /> Awaiting
                          Clearance
                        </span>
                      ) : (
                        <label className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-xl font-bold text-[9px] sm:text-[10px] uppercase tracking-widest transition-colors border border-primary/20 hover:border-transparent cursor-pointer">
                          {uploadingFor === row.id ? (
                            <>
                              <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />{" "}
                              Uploading...
                            </>
                          ) : (
                            <>
                              <AlertTriangle
                                size={12}
                                className="hidden sm:inline-block"
                              />{" "}
                              Submit Deposit Slip
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e) => handleFileUpload(e, row.id)}
                            className="hidden"
                            disabled={uploadingFor === row.id}
                          />
                        </label>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
