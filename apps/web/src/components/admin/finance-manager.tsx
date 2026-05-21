"use client";

import React, { useEffect, useState } from "react";
import {
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  Download,
  Plus,
  Search,
  ExternalLink,
} from "lucide-react";
import clsx from "clsx";
import {
  getAllInvoices,
  updateInvoiceStatus,
  generateInvoice,
} from "@/app/actions/finance";
import { getAllTenantsAction } from "@/app/actions/tenant";

export default function FinanceManager() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    tenantId: "",
    month: "",
    amount: "",
    dueDate: "",
    description: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getAllInvoices();
      setInvoices(data);
      const res = await getAllTenantsAction();
      if (res.success && res.data) {
        setTenants(res.data.filter((t: any) => t.status === "ACTIVE"));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (invoiceId: string, status: string) => {
    setProcessing(invoiceId);
    try {
      const res = await updateInvoiceStatus(invoiceId, status);
      if (res.success) {
        fetchData();
      } else {
        alert("Failed to update status: " + res.error);
      }
    } finally {
      setProcessing(null);
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await generateInvoice({
        tenantId: formData.tenantId,
        month: formData.month,
        amount: parseFloat(formData.amount),
        dueDate: new Date(formData.dueDate),
        description: formData.description,
      });
      if (res.success) {
        alert("Invoice generated successfully!");
        setIsModalOpen(false);
        fetchData();
      } else {
        alert("Failed: " + res.error);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  return (
    <>
      <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/5 rounded-3xl overflow-hidden shadow-sm animate-fade-in-up mt-8">
        <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg text-charcoal dark:text-white flex items-center gap-2">
              <FileText size={18} className="text-slate-400" /> Master Ledger
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
              Manage billing & clear deposit slips
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className={clsx(
              "flex",
              "items-center",
              "gap-2",
              "px-5",
              "py-2.5",
              "bg-primary",
              "text-white",
              "font-bold",
              "text-[10px]",
              "uppercase",
              "tracking-widest",
              "rounded-xl",
              "hover:bg-primary-hover",
              "shadow-md",
              "shadow-primary/20",
              "transition-all",
              "active:scale-95",
            )}
          >
            <Plus size={14} /> Issue Invoice
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Tenant / Shop
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Invoice Details
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Status
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">
                  Verification
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group"
                >
                  <td className="px-6 py-5">
                    <p className="font-bold text-charcoal dark:text-white text-sm">
                      {inv.tenant?.shopName || "Unknown Shop"}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      Unit {inv.tenant?.unitId || "N/A"}
                    </p>
                  </td>
                  <td className="px-6 py-5">
                    <p className="font-black text-charcoal dark:text-white text-sm">
                      ₱{inv.amount.toLocaleString()}
                    </p>
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest mt-1">
                      {inv.invoiceNumber}{inv.status === "PAID" && ` (OR-${inv.invoiceNumber.replace("#INV-", "").replace("#", "")})`} • {inv.month}
                    </p>
                  </td>
                  <td className="px-6 py-5">
                    {inv.status === "PAID" && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-green-50 text-green-600 rounded-lg border border-green-200">
                        <CheckCircle size={12} /> Cleared
                      </span>
                    )}
                    {inv.status === "REVIEWING" && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-blue-50 text-blue-600 rounded-lg border border-blue-200 animate-pulse">
                        <Clock size={12} /> Awaiting Clearance
                      </span>
                    )}
                    {inv.status === "PENDING" && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-amber-50 text-amber-600 rounded-lg border border-amber-200">
                        <AlertTriangle size={12} /> Unpaid
                      </span>
                    )}
                    {inv.status === "OVERDUE" && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-red-50 text-primary rounded-lg border border-red-200">
                        <AlertTriangle size={12} /> Overdue
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-5 text-right">
                    {inv.depositSlipUrl ? (
                      <div className="flex items-center justify-end gap-3">
                        <a
                          href={inv.depositSlipUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-primary transition-colors"
                          title="View Deposit Slip"
                        >
                          <ExternalLink size={14} />
                        </a>
                        {inv.status === "REVIEWING" && (
                          <>
                            <button
                              disabled={processing === inv.id}
                              onClick={() => handleStatusChange(inv.id, "PAID")}
                              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all"
                            >
                              Approve
                            </button>
                            <button
                              disabled={processing === inv.id}
                              onClick={() =>
                                handleStatusChange(inv.id, "PENDING")
                              }
                              className="px-4 py-2 bg-red-50 hover:text-red-600 text-red-500 border border-red-200 font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        No Proof Uploaded
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-12 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest"
                  >
                    No Invoices Found in Ledger
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div
          className={clsx(
            "fixed",
            "inset-0",
            "z-[100]",
            "flex",
            "items-center",
            "justify-center",
            "p-4",
            "overflow-hidden",
          )}
        >
          <div
            className={clsx("absolute", "inset-0", "bg-black/60")}
            onClick={() => setIsModalOpen(false)}
          />
          <div
            className={clsx(
              "relative",
              "w-full",
              "max-w-md",
              "bg-white",
              "dark:bg-zinc-900",
              "rounded-3xl",
              "shadow-2xl",
              "border",
              "border-slate-200",
              "dark:border-white/10",
              "p-8",
              "animate-fade-in-up",
            )}
          >
            <h2
              className={clsx(
                "text-xl",
                "font-black",
                "text-charcoal",
                "dark:text-white",
                "mb-6",
                "uppercase",
                "tracking-tight",
              )}
            >
              Issue New Invoice
            </h2>
            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  className={clsx(
                    "text-[10px]",
                    "font-black",
                    "text-slate-500",
                    "uppercase",
                    "tracking-widest",
                    "px-1",
                  )}
                >
                  Select Tenant
                </label>
                <select
                  required
                  value={formData.tenantId}
                  onChange={(e) =>
                    setFormData({ ...formData, tenantId: e.target.value })
                  }
                  className={clsx(
                    "w-full",
                    "px-4",
                    "py-3",
                    "bg-slate-50",
                    "dark:bg-zinc-800",
                    "text-charcoal",
                    "dark:text-white",
                    "rounded-xl",
                    "border",
                    "border-slate-200",
                    "dark:border-white/5",
                    "focus:border-primary",
                    "outline-none",
                    "transition-all",
                    "text-sm",
                  )}
                >
                  <option value="">Select an active tenant...</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.shopName} (Unit {t.unitId})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    className={clsx(
                      "text-[10px]",
                      "font-black",
                      "text-slate-500",
                      "uppercase",
                      "tracking-widest",
                      "px-1",
                    )}
                  >
                    Billing Month
                  </label>
                  <input
                    required
                    value={formData.month}
                    onChange={(e) =>
                      setFormData({ ...formData, month: e.target.value })
                    }
                    placeholder="e.g. Nov 2026"
                    className={clsx(
                      "w-full",
                      "px-4",
                      "py-3",
                      "bg-slate-50",
                      "dark:bg-zinc-800",
                      "text-charcoal",
                      "dark:text-white",
                      "rounded-xl",
                      "border",
                      "border-slate-200",
                      "dark:border-white/5",
                      "focus:border-primary",
                      "outline-none",
                      "transition-all",
                      "text-sm",
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    className={clsx(
                      "text-[10px]",
                      "font-black",
                      "text-slate-500",
                      "uppercase",
                      "tracking-widest",
                      "px-1",
                    )}
                  >
                    Amount (₱)
                  </label>
                  <input
                    required
                    type="number"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    className={clsx(
                      "w-full",
                      "px-4",
                      "py-3",
                      "bg-slate-50",
                      "dark:bg-zinc-800",
                      "text-charcoal",
                      "dark:text-white",
                      "rounded-xl",
                      "border",
                      "border-slate-200",
                      "dark:border-white/5",
                      "focus:border-primary",
                      "outline-none",
                      "transition-all",
                      "text-sm",
                    )}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label
                  className={clsx(
                    "text-[10px]",
                    "font-black",
                    "text-slate-500",
                    "uppercase",
                    "tracking-widest",
                    "px-1",
                  )}
                >
                  Due Date
                </label>
                <input
                  required
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) =>
                    setFormData({ ...formData, dueDate: e.target.value })
                  }
                  className={clsx(
                    "w-full",
                    "px-4",
                    "py-3",
                    "bg-slate-50",
                    "dark:bg-zinc-800",
                    "text-charcoal",
                    "dark:text-white",
                    "rounded-xl",
                    "border",
                    "border-slate-200",
                    "dark:border-white/5",
                    "focus:border-primary",
                    "outline-none",
                    "transition-all",
                    "text-sm",
                  )}
                />
              </div>
              <div className={clsx("flex", "items-center", "gap-3", "pt-4")}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={clsx(
                    "flex-1",
                    "py-3",
                    "text-xs",
                    "font-bold",
                    "text-slate-500",
                    "bg-slate-100",
                    "dark:bg-zinc-800",
                    "rounded-xl",
                    "uppercase",
                    "tracking-widest",
                    "hover:bg-slate-200",
                    "dark:hover:bg-zinc-700",
                    "transition-all",
                  )}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={clsx(
                    "flex-[2]",
                    "py-3",
                    "bg-primary",
                    "text-white",
                    "font-bold",
                    "rounded-xl",
                    "text-xs",
                    "uppercase",
                    "tracking-widest",
                    "shadow-md",
                    "shadow-primary/20",
                    "hover:bg-primary-hover",
                    "active:scale-95",
                    "transition-all",
                  )}
                >
                  Generate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
