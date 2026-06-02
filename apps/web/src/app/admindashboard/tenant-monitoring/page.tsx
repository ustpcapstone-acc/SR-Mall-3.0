"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Filter,
  MoreVertical,
  Store,
  Calendar,
  FileText,
  AlertTriangle,
  Zap,
  MessageSquare,
  Receipt,
  Edit,
  X,
  Star,
  TrendingUp,
  UserPlus,
  CheckCircle,
  Building,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Clock,
  BarChart3,
  PieChart,
  Download,
  Trash2,
  Eye,
  RefreshCw,
  ArrowUpDown,
  ChevronDown,
  LayoutGrid,
  List,
  PhilippinePeso,
  Activity,
  PieChart as PieChartIcon,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  ShieldAlert,
  CreditCard as PaymentIcon,
} from "lucide-react";
import { RegisterTenantModal } from "@/components/admin/register-tenant-modal";
import clsx from "clsx";
import {
  getAllTenantsAction,
  deleteTenantAction,
  approveTenantAction,
  updateStorefrontAction,
  getTenantReportDataAction,
  adminUpdateTenantAction,
} from "@/app/actions/tenant";
// Dynamic import used in handler to prevent SSR issues
import { getAreaSlots } from "@/app/actions/space-slot";
import {
  getAllInvoices,
  generateInvoice,
  updateInvoiceStatus,
  recordManualPaymentAction,
} from "@/app/actions/finance";

interface Tenant {
  id: string;
  shopName: string;
  unitId: string;
  description?: string;
  logoUrl?: string;
  isOpen: boolean;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING" | "REJECTED";
  metrics?: {
    clicks: number;
    offersClaimed: number;
    rating: number;
    inquiries: number;
  };
  user?: {
    id: string;
    email: string;
    name: string;
  };
  contractStart?: string;
  contractEnd?: string;
  rentCost?: number;
  paymentStatus?: string;
  violations?: number;
  avgRating?: number;
  reviewCount?: number;
  nextDueDate?: string;
}

const STATUS_CONFIG = {
  ACTIVE: {
    color: "bg-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    text: "text-emerald-600",
  },
  INACTIVE: {
    color: "bg-slate-400",
    bg: "bg-slate-400/10",
    border: "border-slate-400/20",
    text: "text-slate-500",
  },
  SUSPENDED: {
    color: "bg-red-500",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    text: "text-red-600",
  },
  PENDING: {
    color: "bg-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    text: "text-amber-600",
  },
  REJECTED: {
    color: "bg-red-600",
    bg: "bg-red-600/10",
    border: "border-red-600/20",
    text: "text-red-700",
  },
};

const PAYMENT_CONFIG = {
  "🟢 Cleared": {
    bg: "bg-emerald-500/10",
    text: "text-emerald-600",
    border: "border-emerald-500/20",
  },
  "🟡 Pending Verification": {
    bg: "bg-amber-500/10",
    text: "text-amber-600",
    border: "border-amber-500/20",
  },
  "🔴 Overdue": {
    bg: "bg-red-500/10",
    text: "text-red-600",
    border: "border-red-500/20",
  },
  PENDING: {
    bg: "bg-slate-500/10",
    text: "text-slate-600",
    border: "border-slate-500/20",
  },
};

export default function TenantMonitoring() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);
  const [isApproving, setIsApproving] = useState<string | null>(null);
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [selectedUnitForApproval, setSelectedUnitForApproval] =
    useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "status" | "rent">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    pending: 0,
    overdue: 0,
    totalRevenue: 0,
    collectedRevenue: 0,
    pendingRevenue: 0,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [editFormData, setEditFormData] = useState({
    shopName: "",
    unitId: "",
    status: "",
    rentCost: 0,
    description: "",
  });
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [billFormData, setBillFormData] = useState({
    amount: 0,
    month: "",
    dueDate: "",
    description: "Manual Billing - Rent & Utilities",
  });

  const loadTenants = async () => {
    setLoading(true);
    console.log("Loading tenants...");
    try {
      const [result, invoicesResult] = await Promise.all([
        getAllTenantsAction(),
        getAllInvoices(),
        getAreaSlots(),
      ]);

      console.log("getAllTenantsAction result:", result);
      if (result.success && result.data) {
        console.log("Tenants loaded:", result.data.length);

        const enhancedTenants: Tenant[] = result.data.map(
          (item: any, index: number) => {
            const tenantInvoices = invoicesResult.filter(
              (inv: any) => inv.tenantId === item.id,
            );

            let paymentStatus: any = "🟢 Cleared";
            if (tenantInvoices.length > 0) {
              const hasOverdue = tenantInvoices.some(
                (inv: any) =>
                  inv.status === "OVERDUE" ||
                  (inv.status === "PENDING" &&
                    new Date(inv.dueDate) < new Date()),
              );
              const hasReviewing = tenantInvoices.some(
                (inv: any) => inv.status === "REVIEWING",
              );
              if (hasOverdue) paymentStatus = "🔴 Overdue";
              else if (hasReviewing) paymentStatus = "🟡 Pending Verification";
              else if (
                tenantInvoices.some((inv: any) => inv.status === "PENDING")
              )
                paymentStatus = "PENDING";
            }

            const createdDate = item.createdAt
              ? new Date(item.createdAt)
              : new Date();
            const startStr = createdDate.toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            });
            const endObj = new Date(createdDate);
            endObj.setFullYear(endObj.getFullYear() + 1);
            const endStr = endObj.toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            });

            const unpaid = tenantInvoices.filter(
              (inv: any) => inv.status !== "PAID",
            );
            const nextInv = unpaid.sort(
              (a: any, b: any) =>
                new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
            )[0];
            const nextDueDate = nextInv
              ? new Date(nextInv.dueDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : "N/A";

            const slot =
              (availableSlots.length > 0
                ? availableSlots
                : result.data?.slots
              )?.find((s: any) => s.tenant_id === item.id) ||
              availableSlots.find((s: any) => s.unit_id === item.unitId);
            const activeRentCost =
              slot?.base_rent ||
              tenantInvoices[0]?.amount ||
              3000 + index * 500;

            return {
              ...item,
              contractStart: startStr,
              contractEnd: endStr,
              description: item.description || "No store description provided.",
              rentCost: activeRentCost,
              paymentStatus,
              nextDueDate,
              violations: 0,
              metrics: {
                clicks: 500 + index * 200,
                offersClaimed: 50 + index * 20,
                rating: item.avgRating || 0,
                inquiries: item.reviewCount || 0,
              },
            };
          },
        );

        console.log("Enhanced tenants:", enhancedTenants);
        setTenants(enhancedTenants);
        setAllInvoices(invoicesResult);

        setStats({
          total: enhancedTenants.length,
          active: enhancedTenants.filter(
            (tenant: Tenant) => tenant.status === "ACTIVE",
          ).length,
          pending: enhancedTenants.filter(
            (tenant: Tenant) => tenant.status === "PENDING",
          ).length,
          overdue: enhancedTenants.filter(
            (tenant: Tenant) => tenant.paymentStatus === "OVERDUE",
          ).length,
          totalRevenue: enhancedTenants.reduce(
            (sum: number, tenant: Tenant) => sum + (tenant.rentCost || 0),
            0,
          ),
          collectedRevenue: invoicesResult
            .filter((inv: any) => inv.status === "PAID")
            .reduce((sum: number, inv: any) => sum + inv.amount, 0),
          pendingRevenue: invoicesResult
            .filter(
              (inv: any) =>
                inv.status === "PENDING" || inv.status === "REVIEWING",
            )
            .reduce((sum: number, inv: any) => sum + inv.amount, 0),
        });
      } else {
        setToast({ msg: "Failed to load tenants", type: "error" });
      }
    } catch (error) {
      console.error("Error loading tenants:", error);
      setToast({ msg: "Error loading tenants", type: "error" });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTenants();
    loadAvailableSlots();

    // Pseudo-realtime polling every 20 seconds
    const interval = setInterval(() => {
      loadTenants();
    }, 20000);

    return () => clearInterval(interval);
  }, []);

  const loadAvailableSlots = async () => {
    const result = await getAreaSlots();
    if (result.success && result.data) {
      setAvailableSlots(
        result.data.filter((s: any) => s.status === "AVAILABLE"),
      );
    }
  };

  const handleRegistrationSuccess = (shopName: string, slotId: string) => {
    setToast({ msg: `✓ ${shopName} registered successfully`, type: "success" });
    loadTenants();
    setTimeout(() => setToast(null), 5000);
  };

  const handleDeleteTenant = async (tenantId: string) => {
    if (!confirm("Are you sure you want to delete this tenant?")) return;

    try {
      const result = await deleteTenantAction(tenantId);
      if (result.success) {
        setToast({ msg: "Tenant deleted successfully", type: "success" });
        setSelectedTenant(null);
        loadTenants();
      } else {
        setToast({
          msg: result.error || "Failed to delete tenant",
          type: "error",
        });
      }
    } catch (error) {
      setToast({ msg: "Error deleting tenant", type: "error" });
    }
  };

  const handleApproveTenant = async (tenantId: string) => {
    if (!selectedUnitForApproval) {
      setToast({ msg: "Please select a Unit ID to assign", type: "error" });
      return;
    }

    try {
      setIsApproving(tenantId);
      const result = await approveTenantAction(
        tenantId,
        selectedUnitForApproval,
      );
      if (result.success) {
        setToast({
          msg: "✓ Merchant approved! User role changed to TENANT",
          type: "success",
        });
        setSelectedTenant(null);
        setSelectedUnitForApproval("");
        loadTenants();
      } else {
        setToast({ msg: result.error || "Failed to approve", type: "error" });
      }
    } catch (error) {
      setToast({ msg: "Error approving merchant", type: "error" });
    } finally {
      setIsApproving(null);
    }
  };

  const handleEditTenant = () => {
    if (!selectedTenant) return;
    setEditingTenant(selectedTenant);
    setEditFormData({
      shopName: selectedTenant.shopName || "",
      unitId: selectedTenant.unitId || "",
      status: selectedTenant.status || "",
      rentCost: selectedTenant.rentCost || 0,
      description: selectedTenant.description || "",
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingTenant) return;
    setLoading(true);
    try {
      const res = await adminUpdateTenantAction(editingTenant.id, editFormData);
      if (res.success) {
        setToast({ msg: "Tenant updated successfully!", type: "success" });
        setIsEditModalOpen(false);
        setSelectedTenant(null);
        loadTenants();
      } else {
        setToast({ msg: res.error || "Failed to update", type: "error" });
      }
    } catch (e: any) {
      setToast({ msg: "Error: " + e.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleViewDocuments = () => {
    setToast({ msg: "Documents feature coming soon!", type: "success" });
  };

  const handleSendMessage = () => {
    if (!selectedTenant) return;
    window.location.href = `/admindashboard/messages?tenantId=${selectedTenant.id}`;
  };

  const handlePostMonthlyBill = () => {
    if (!selectedTenant) return;
    setBillFormData({
      amount: selectedTenant.rentCost || 3000,
      month: new Date().toLocaleString("default", { month: "short", year: "numeric" }),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      description: "Manual Billing - Rent & Utilities",
    });
    setIsBillModalOpen(true);
  };

  const handleSubmitBill = async () => {
    if (!selectedTenant) return;
    
    if (billFormData.amount <= 0) {
      setToast({ msg: "Invalid amount", type: "error" });
      return;
    }

    const dueDate = new Date(billFormData.dueDate);
    if (isNaN(dueDate.getTime())) {
      setToast({ msg: "Invalid date format", type: "error" });
      return;
    }

    setLoading(true);
    setToast({ msg: "Posting monthly bill...", type: "success" });

    try {
      const res = await generateInvoice({
        tenantId: selectedTenant.id,
        month: billFormData.month,
        amount: billFormData.amount,
        dueDate: dueDate,
        description: billFormData.description,
      });

      if (res.success) {
        setToast({ msg: "Invoice successfully generated!", type: "success" });
        setIsBillModalOpen(false);
        loadTenants();
      } else {
        setToast({ msg: "Failed: " + res.error, type: "error" });
      }
    } catch (err: any) {
      setToast({ msg: "Error: " + err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleExportReport = async () => {
    setIsExporting(true);
    try {
      const { generateTenantPDF } = await import("@/utils/report-generator");
      const result = await getTenantReportDataAction();
      if (result.success && result.data) {
        await generateTenantPDF(result.data);
        setToast({ msg: "Report generated successfully!", type: "success" });
      } else {
        setToast({
          msg: result.error || "Failed to generate report",
          type: "error",
        });
      }
    } catch (error) {
      console.error("Export error:", error);
      setToast({ msg: "Error generating report", type: "error" });
    } finally {
      setIsExporting(false);
    }
  };

  const filteredTenants = tenants
    .filter((t) => {
      const matchesSearch =
        t.shopName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.unitId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.user?.email?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      const matchesPayment =
        paymentFilter === "all" || t.paymentStatus === paymentFilter;
      return matchesSearch && matchesStatus && matchesPayment;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = (a.shopName || "").localeCompare(b.shopName || "");
          break;
        case "status":
          comparison = (a.status || "").localeCompare(b.status || "");
          break;
        case "rent":
          comparison = (a.rentCost || 0) - (b.rentCost || 0);
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

  const toggleSort = (field: "name" | "status" | "rent") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const getStatusBadge = (status: string) => {
    const config =
      STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ||
      STATUS_CONFIG.INACTIVE;
    return (
      <span
        className={clsx(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest",
          config.bg,
          config.text,
          config.border,
        )}
      >
        <span className={clsx("w-1.5 h-1.5 rounded-full", config.color)}></span>
        {status}
      </span>
    );
  };

  const getPaymentBadge = (status: string) => {
    const config =
      PAYMENT_CONFIG[status as keyof typeof PAYMENT_CONFIG] ||
      PAYMENT_CONFIG["🟢 Cleared"];
    return (
      <span
        className={clsx(
          "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border",
          config.bg,
          config.text,
          config.border,
        )}
      >
        {status}
      </span>
    );
  };

  return (
    <>
      {/* Toast Notification */}
      {toast && (
        <div
          className={clsx(
            "fixed top-24 right-8 z-[300] flex items-center gap-3 px-5 py-4 font-bold text-sm rounded-2xl shadow-2xl animate-fade-in-up",
            toast.type === "success"
              ? "bg-emerald-500 text-white shadow-emerald-500/30"
              : "bg-red-500 text-white shadow-red-500/30",
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle size={18} />
          ) : (
            <AlertTriangle size={18} />
          )}
          {toast.msg}
          <button
            onClick={() => setToast(null)}
            className={clsx("ml-2", "opacity-70", "hover:opacity-100")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <RegisterTenantModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSuccess={handleRegistrationSuccess}
      />

      {/* Edit Tenant Modal */}
      {isEditModalOpen && editingTenant && (
        <div
          className={clsx(
            "fixed",
            "inset-0",
            "z-[250]",
            "flex",
            "items-center",
            "justify-center",
            "p-4",
          )}
        >
          <div
            className={clsx(
              "absolute",
              "inset-0",
              "bg-black/60",
              "backdrop-blur-sm",
            )}
            onClick={() => setIsEditModalOpen(false)}
          />
          <div
            className={clsx(
              "relative",
              "w-full",
              "max-w-lg",
              "bg-white",
              "dark:bg-zinc-950",
              "rounded-[2rem]",
              "shadow-2xl",
              "overflow-hidden",
              "animate-fade-in-up",
            )}
          >
            <div
              className={clsx("bg-primary", "p-8", "text-white", "relative")}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                  <Edit size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight">
                    Edit Tenant
                  </h2>
                  <p className="text-xs text-white/70 font-bold uppercase tracking-widest">
                    Admin Authorization Required
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="absolute top-8 right-8 text-white/60 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-5">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                  Shop Name
                </label>
                <input
                  type="text"
                  value={editFormData.shopName}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      shopName: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-xl text-sm font-bold focus:border-primary focus:outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                    Unit ID
                  </label>
                  <select
                    value={editFormData.unitId}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        unitId: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-xl text-sm font-bold focus:border-primary focus:outline-none transition-all"
                  >
                    <option value={editingTenant.unitId}>
                      {editingTenant.unitId} (Current)
                    </option>
                    {availableSlots.map((s) => (
                      <option key={s.unit_id} value={s.unit_id}>
                        {s.unit_id}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                    Status
                  </label>
                  <select
                    value={editFormData.status}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        status: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-xl text-sm font-bold focus:border-primary focus:outline-none transition-all"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PENDING">PENDING</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                  Monthly Rent (₱)
                </label>
                <input
                  type="number"
                  value={editFormData.rentCost}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      rentCost: Number(e.target.value),
                    })
                  }
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-xl text-sm font-black text-emerald-500 focus:border-primary focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                  Description / Store Type
                </label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      description: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-xl text-sm font-medium focus:border-primary focus:outline-none transition-all resize-none"
                  placeholder="e.g. Luxury Footwear Provider"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-3.5 bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-slate-400 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={loading}
                  className="flex-[2] py-3.5 bg-primary text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <>
                      <CheckCircle size={16} /> Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bill Tenant Modal */}
      {isBillModalOpen && selectedTenant && (
        <div
          className={clsx(
            "fixed",
            "inset-0",
            "z-[250]",
            "flex",
            "items-center",
            "justify-center",
            "p-4",
          )}
        >
          <div
            className={clsx(
              "absolute",
              "inset-0",
              "bg-black/60",
              "backdrop-blur-sm",
            )}
            onClick={() => setIsBillModalOpen(false)}
          />
          <div
            className={clsx(
              "relative",
              "w-full",
              "max-w-lg",
              "bg-white",
              "dark:bg-zinc-950",
              "rounded-[2rem]",
              "shadow-2xl",
              "overflow-hidden",
              "animate-fade-in-up",
            )}
          >
            <div
              className={clsx("bg-[#BE1E2D]", "p-8", "text-white", "relative")}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                  <Receipt size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight">
                    Post Monthly Bill
                  </h2>
                  <p className="text-xs text-white/70 font-bold uppercase tracking-widest">
                    Billing Information
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBillModalOpen(false)}
                className="absolute top-8 right-8 text-white/60 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-5">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                  Amount to Bill (₱)
                </label>
                <input
                  type="number"
                  value={billFormData.amount}
                  onChange={(e) =>
                    setBillFormData({
                      ...billFormData,
                      amount: Number(e.target.value),
                    })
                  }
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-xl text-sm font-black text-emerald-500 focus:border-[#BE1E2D] focus:outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                    Billing Month
                  </label>
                  <input
                    type="text"
                    value={billFormData.month}
                    onChange={(e) =>
                      setBillFormData({
                        ...billFormData,
                        month: e.target.value,
                      })
                    }
                    placeholder="e.g. Nov 2026"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-xl text-sm font-bold focus:border-[#BE1E2D] focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={billFormData.dueDate}
                    onChange={(e) =>
                      setBillFormData({
                        ...billFormData,
                        dueDate: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-xl text-sm font-bold focus:border-[#BE1E2D] focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                  Description
                </label>
                <textarea
                  value={billFormData.description}
                  onChange={(e) =>
                    setBillFormData({
                      ...billFormData,
                      description: e.target.value,
                    })
                  }
                  rows={2}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-xl text-sm font-medium focus:border-[#BE1E2D] focus:outline-none transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setIsBillModalOpen(false)}
                  className="flex-1 py-3.5 bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-slate-400 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitBill}
                  disabled={loading}
                  className="flex-[2] py-3.5 bg-[#BE1E2D] text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-xl shadow-red-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <>
                      <CheckCircle size={16} /> Post Bill
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className={clsx(
          "min-h-screen",
          "bg-transparent",
          "p-4",
          "lg:p-8",
          "animate-fade-in-up",
          "max-w-[1600px]",
          "mx-auto",
        )}
      >
        {/* Background Decor */}
        <div
          className={clsx(
            "fixed",
            "inset-0",
            "pointer-events-none",
            "opacity-20",
            "dark:opacity-40",
            "overflow-hidden",
            "-z-10",
          )}
        >
          <div
            className={clsx(
              "absolute",
              "top-[20%]",
              "right-[-5%]",
              "w-[30%]",
              "h-[30%]",
              "bg-primary/10",
              "blur-[120px]",
              "rounded-full",
            )}
          />
        </div>

        {/* Professional Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
              <Activity size={10} className="text-primary animate-pulse" />
              <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">
                Live Mall ecosystem
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-charcoal dark:text-white tracking-tighter uppercase leading-none">
              Tenant{" "}
              <span className="text-slate-300 dark:text-zinc-800">
                Intelligence.
              </span>
            </h1>
            <p className="text-sm font-medium text-slate-500 max-w-xl">
              Unified command center for real-time tenant performance, financial
              logistics, and boutique oversight.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm hidden sm:flex items-center gap-4">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                <TrendingUp size={20} />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Est. Revenue
                </p>
                <p className="text-lg font-black text-charcoal dark:text-white">
                  ₱{(stats.totalRevenue || 0).toLocaleString()}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsRegisterOpen(true)}
              className="h-14 px-8 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:scale-105 transition-all shadow-xl shadow-primary/20 active:scale-95"
            >
              <UserPlus size={18} /> Add Boutique
            </button>
          </div>
        </div>

        {/* Executive Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <div className="group relative p-1">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-10 transition-opacity"></div>
            <div className="relative p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-[1.8rem] shadow-sm overflow-hidden h-full">
              <div className="flex items-start justify-between mb-8">
                <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                  <Store size={22} />
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Active Units
                  </span>
                  <div className="flex items-center gap-1 text-emerald-500">
                    <ArrowUpRight size={10} />
                    <span className="text-[10px] font-bold">4% MoM</span>
                  </div>
                </div>
              </div>
              <p className="text-4xl font-black text-charcoal dark:text-white tracking-tighter">
                {stats.active}
              </p>
              <div className="mt-2 h-1 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                  style={{ width: `${(stats.active / stats.total) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="group relative p-1">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-10 transition-opacity"></div>
            <div className="relative p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-[1.8rem] shadow-sm overflow-hidden h-full">
              <div className="flex items-start justify-between mb-8">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                  <PhilippinePeso size={22} />
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Collected
                  </span>
                  <div className="flex items-center gap-1 text-emerald-500">
                    <ArrowUpRight size={10} />
                    <span className="text-[10px] font-bold">12% New</span>
                  </div>
                </div>
              </div>
              <p className="text-4xl font-black text-charcoal dark:text-white tracking-tighter">
                ₱{(stats.collectedRevenue / 1000).toFixed(0)}K
              </p>
              <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">
                Pending: ₱{(stats.pendingRevenue / 1000).toFixed(0)}K
              </p>
            </div>
          </div>

          <div className="group relative p-1">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-orange-600 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-10 transition-opacity"></div>
            <div className="relative p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-[1.8rem] shadow-sm overflow-hidden h-full">
              <div className="flex items-start justify-between mb-8">
                <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                  <Clock size={22} />
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Pipeline
                  </span>
                  <div className="flex items-center gap-1 text-amber-500">
                    <Activity size={10} />
                    <span className="text-[10px] font-bold">Reviewing</span>
                  </div>
                </div>
              </div>
              <p className="text-4xl font-black text-charcoal dark:text-white tracking-tighter">
                {stats.pending}
              </p>
              <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">
                Awaiting Onboarding
              </p>
            </div>
          </div>

          <div className="group relative p-1">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-pink-600 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-10 transition-opacity"></div>
            <div className="relative p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-[1.8rem] shadow-sm overflow-hidden h-full">
              <div className="flex items-start justify-between mb-8">
                <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                  <AlertTriangle size={22} />
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Deficits
                  </span>
                  <div className="flex items-center gap-1 text-red-500 font-black">
                    <ShieldAlert size={10} />
                    <span className="text-[10px]">Overdue</span>
                  </div>
                </div>
              </div>
              <p className="text-4xl font-black text-charcoal dark:text-white tracking-tighter">
                {stats.overdue}
              </p>
              <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">
                Urgent Action Items
              </p>
            </div>
          </div>
        </div>

        {/* Control Bar */}
        <div
          className={clsx(
            "flex",
            "flex-wrap",
            "gap-4",
            "p-4",
            "bg-white/40",
            "dark:bg-white/5",
            "border",
            "border-slate-200",
            "dark:border-white/10",
            "rounded-3xl",
            "backdrop-blur-xl",
            "shadow-2xl",
            "shadow-black/5",
            "mb-6",
          )}
        >
          {/* Search */}
          <div
            className={clsx(
              "flex-1",
              "min-w-[200px]",
              "relative",
              "flex",
              "items-center",
              "group",
            )}
          >
            <Search
              className={clsx(
                "absolute",
                "left-4",
                "text-slate-400",
                "group-focus-within:text-primary",
                "transition-colors",
              )}
              size={20}
            />
            <input
              type="text"
              placeholder="Search tenants, units, emails..."
              className={clsx(
                "w-full",
                "pl-12",
                "pr-6",
                "py-3",
                "bg-slate-50",
                "dark:bg-zinc-950/50",
                "border",
                "border-slate-200",
                "dark:border-white/5",
                "rounded-2xl",
                "text-charcoal",
                "dark:text-white",
                "font-medium",
                "focus:outline-none",
                "focus:border-primary",
                "focus:ring-4",
                "focus:ring-primary/10",
                "transition-all",
                "placeholder:text-slate-400",
              )}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={clsx(
              "px-4",
              "py-3",
              "bg-slate-50",
              "dark:bg-zinc-950/50",
              "border",
              "border-slate-200",
              "dark:border-white/5",
              "rounded-2xl",
              "text-charcoal",
              "dark:text-white",
              "font-medium",
              "focus:outline-none",
              "focus:border-primary",
              "transition-all",
            )}
          >
            <option value="all">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className={clsx(
              "px-4",
              "py-3",
              "bg-slate-50",
              "dark:bg-zinc-950/50",
              "border",
              "border-slate-200",
              "dark:border-white/5",
              "rounded-2xl",
              "text-charcoal",
              "dark:text-white",
              "font-medium",
              "focus:outline-none",
              "focus:border-primary",
              "transition-all",
            )}
          >
            <option value="all">Financial Health (All)</option>
            <option value="🟢 Cleared">🟢 Cleared</option>
            <option value="🟡 Pending Verification">
              🟡 Pending Verification
            </option>
            <option value="🔴 Overdue">🔴 Overdue</option>
            <option value="PENDING">Awaiting Invoice</option>
          </select>

          {/* View Toggle */}
          <div
            className={clsx(
              "flex",
              "items-center",
              "gap-2",
              "p-2",
              "bg-slate-50",
              "dark:bg-zinc-950/50",
              "border",
              "border-slate-200",
              "dark:border-white/5",
              "rounded-2xl",
            )}
          >
            <button
              onClick={() => setViewMode("table")}
              className={clsx(
                "p-2 rounded-xl transition-all",
                viewMode === "table"
                  ? "bg-primary text-white"
                  : "text-slate-400",
              )}
            >
              <List size={20} />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={clsx(
                "p-2 rounded-xl transition-all",
                viewMode === "grid"
                  ? "bg-primary text-white"
                  : "text-slate-400",
              )}
            >
              <LayoutGrid size={20} />
            </button>
          </div>

          {/* Export */}
          <button
            onClick={handleExportReport}
            disabled={isExporting}
            className={clsx(
              "flex",
              "items-center",
              "gap-2",
              "px-6",
              "py-3",
              "bg-[#BE1E2D]/5",
              "hover:bg-[#BE1E2D]/10",
              "border",
              "border-[#BE1E2D]/20",
              "rounded-2xl",
              "text-[#BE1E2D]",
              "font-bold",
              "transition-all",
              "active:scale-95",
              isExporting && "opacity-50 cursor-not-allowed",
            )}
          >
            {isExporting ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <FileText size={18} />
            )}
            {isExporting ? "Generating Report..." : "Download Report"}
          </button>
        </div>

        {/* Loading State */}
        {loading ? (
          <div
            className={clsx(
              "flex",
              "flex-col",
              "items-center",
              "justify-center",
              "h-96",
              "gap-6",
            )}
          >
            <div className="relative">
              <div
                className={clsx(
                  "w-20",
                  "h-20",
                  "border-4",
                  "border-primary/10",
                  "border-t-primary",
                  "rounded-full",
                  "animate-spin",
                )}
              />
              <div
                className={clsx(
                  "absolute",
                  "inset-0",
                  "w-20",
                  "h-20",
                  "border-4",
                  "border-transparent",
                  "border-b-primary/40",
                  "rounded-full",
                  "animate-reverse-spin",
                )}
              />
            </div>
            <p
              className={clsx(
                "animate-pulse",
                "tracking-[0.5em]",
                "uppercase",
                "text-[10px]",
                "font-black",
                "text-slate-400",
              )}
            >
              Loading Tenant Data
            </p>
          </div>
        ) : (
          <>
            {/* Table View */}
            {viewMode === "table" ? (
              <div
                className={clsx(
                  "bg-white",
                  "dark:bg-zinc-900",
                  "rounded-3xl",
                  "border",
                  "border-slate-200",
                  "dark:border-white/5",
                  "shadow-sm",
                  "overflow-hidden",
                )}
              >
                <div className="overflow-x-auto">
                  <table
                    className={clsx("w-full", "text-left", "border-collapse")}
                  >
                    <thead>
                      <tr
                        className={clsx(
                          "border-b",
                          "border-slate-200",
                          "dark:border-white/5",
                          "bg-slate-50/50",
                          "dark:bg-white/5",
                        )}
                      >
                        <th
                          className={clsx(
                            "px-6",
                            "py-4",
                            "text-[10px]",
                            "font-black",
                            "uppercase",
                            "tracking-widest",
                            "text-slate-400",
                            "cursor-pointer",
                            "hover:text-charcoal",
                            "dark:hover:text-white",
                            "transition-colors",
                          )}
                          onClick={() => toggleSort("name")}
                        >
                          <div
                            className={clsx("flex", "items-center", "gap-2")}
                          >
                            Tenant
                            <ArrowUpDown
                              size={12}
                              className={
                                sortBy === "name" ? "text-primary" : ""
                              }
                            />
                          </div>
                        </th>
                        <th
                          className={clsx(
                            "px-6",
                            "py-4",
                            "text-[10px]",
                            "font-black",
                            "uppercase",
                            "tracking-widest",
                            "text-slate-400",
                          )}
                        >
                          Unit
                        </th>
                        <th
                          className={clsx(
                            "px-6",
                            "py-4",
                            "text-[10px]",
                            "font-black",
                            "uppercase",
                            "tracking-widest",
                            "text-slate-400",
                            "cursor-pointer",
                            "hover:text-charcoal",
                            "dark:hover:text-white",
                            "transition-colors",
                          )}
                          onClick={() => toggleSort("status")}
                        >
                          <div
                            className={clsx("flex", "items-center", "gap-2")}
                          >
                            Status
                            <ArrowUpDown
                              size={12}
                              className={
                                sortBy === "status" ? "text-primary" : ""
                              }
                            />
                          </div>
                        </th>
                        <th
                          className={clsx(
                            "px-6",
                            "py-4",
                            "text-[10px]",
                            "font-black",
                            "uppercase",
                            "tracking-widest",
                            "text-slate-400",
                          )}
                        >
                          Financial Health
                        </th>
                        <th
                          className={clsx(
                            "px-6",
                            "py-4",
                            "text-[10px]",
                            "font-black",
                            "uppercase",
                            "tracking-widest",
                            "text-slate-400",
                          )}
                        >
                          Due Date
                        </th>
                        <th
                          className={clsx(
                            "px-6",
                            "py-4",
                            "text-[10px]",
                            "font-black",
                            "uppercase",
                            "tracking-widest",
                            "text-slate-400",
                            "cursor-pointer",
                            "hover:text-charcoal",
                            "dark:hover:text-white",
                            "transition-colors",
                          )}
                          onClick={() => toggleSort("rent")}
                        >
                          <div
                            className={clsx("flex", "items-center", "gap-2")}
                          >
                            Monthly Rent
                            <ArrowUpDown
                              size={12}
                              className={
                                sortBy === "rent" ? "text-primary" : ""
                              }
                            />
                          </div>
                        </th>
                        <th
                          className={clsx(
                            "px-6",
                            "py-4",
                            "text-[10px]",
                            "font-black",
                            "uppercase",
                            "tracking-widest",
                            "text-slate-400",
                          )}
                        >
                          Metrics
                        </th>
                        <th
                          className={clsx(
                            "px-6",
                            "py-4",
                            "text-[10px]",
                            "font-black",
                            "uppercase",
                            "tracking-widest",
                            "text-slate-400",
                            "text-right",
                          )}
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody
                      className={clsx(
                        "divide-y",
                        "divide-slate-200",
                        "dark:divide-white/5",
                      )}
                    >
                      {filteredTenants.map((tenant) => {
                        const statusConfig =
                          STATUS_CONFIG[tenant.status] ||
                          STATUS_CONFIG.INACTIVE;
                        const paymentConfig =
                          PAYMENT_CONFIG[
                            tenant.paymentStatus as keyof typeof PAYMENT_CONFIG
                          ] || PAYMENT_CONFIG["🟢 Cleared"];

                        return (
                          <tr
                            key={tenant.id}
                            onClick={() => setSelectedTenant(tenant)}
                            className={clsx(
                              "hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer",
                              selectedTenant?.id === tenant.id
                                ? "bg-primary/5 dark:bg-primary/10 border-l-4 border-primary"
                                : "border-l-4 border-transparent",
                            )}
                          >
                            <td className={clsx("px-6", "py-5")}>
                              <div
                                className={clsx(
                                  "flex",
                                  "items-center",
                                  "gap-4",
                                )}
                              >
                                <div
                                  className={clsx(
                                    "w-12",
                                    "h-12",
                                    "rounded-xl",
                                    "bg-slate-100",
                                    "dark:bg-zinc-800",
                                    "flex",
                                    "items-center",
                                    "justify-center",
                                    "text-slate-500",
                                    "overflow-hidden",
                                  )}
                                >
                                  {tenant.logoUrl ? (
                                    <img
                                      src={tenant.logoUrl}
                                      alt=""
                                      className={clsx(
                                        "w-full",
                                        "h-full",
                                        "object-cover",
                                      )}
                                    />
                                  ) : (
                                    <Store size={20} />
                                  )}
                                </div>
                                <div>
                                  <p
                                    className={clsx(
                                      "font-bold",
                                      "text-charcoal",
                                      "dark:text-white",
                                    )}
                                  >
                                    {tenant.shopName}
                                  </p>
                                  <p
                                    className={clsx(
                                      "text-[10px]",
                                      "text-slate-400",
                                    )}
                                  >
                                    {tenant.user?.email}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className={clsx("px-6", "py-5")}>
                              <span
                                className={clsx(
                                  "font-bold",
                                  "text-charcoal",
                                  "dark:text-white",
                                )}
                              >
                                {tenant.unitId}
                              </span>
                            </td>
                            <td className={clsx("px-6", "py-5")}>
                              <span
                                className={clsx(
                                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                                  statusConfig.bg,
                                  statusConfig.text,
                                  statusConfig.border,
                                )}
                              >
                                <span
                                  className={clsx(
                                    "w-1.5 h-1.5 rounded-full",
                                    statusConfig.color,
                                  )}
                                ></span>
                                {tenant.status}
                              </span>
                            </td>
                            <td className={clsx("px-6", "py-5")}>
                              <span
                                className={clsx(
                                  "px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border",
                                  paymentConfig.bg,
                                  paymentConfig.text,
                                  paymentConfig.border,
                                )}
                              >
                                {tenant.paymentStatus}
                              </span>
                            </td>
                            <td className={clsx("px-6", "py-5")}>
                              <div
                                className={clsx(
                                  "flex items-center gap-1.5 font-black text-[10px] uppercase tracking-[0.15em]",
                                  tenant.paymentStatus === "🔴 Overdue"
                                    ? "text-primary"
                                    : "text-charcoal dark:text-white",
                                )}
                              >
                                {tenant.nextDueDate !== "N/A" && (
                                  <Calendar size={10} className="shrink-0" />
                                )}
                                {tenant.nextDueDate}
                              </div>
                            </td>
                            <td className={clsx("px-6", "py-5")}>
                              <span
                                className={clsx(
                                  "font-black text-charcoal dark:text-white text-sm",
                                )}
                              >
                                ₱{(tenant.rentCost || 0).toLocaleString()}
                              </span>
                            </td>
                            <td className={clsx("px-6", "py-5")}>
                              <div
                                className={clsx(
                                  "flex",
                                  "items-center",
                                  "gap-4",
                                  "text-xs",
                                  "text-slate-500",
                                )}
                              >
                                <span
                                  className={clsx(
                                    "flex",
                                    "items-center",
                                    "gap-1",
                                  )}
                                >
                                  <TrendingUp size={12} />{" "}
                                  {tenant.metrics?.clicks || 0}
                                </span>
                                <span
                                  className={clsx(
                                    "flex",
                                    "items-center",
                                    "gap-1",
                                  )}
                                >
                                  <Star size={12} className="text-amber-500" />{" "}
                                  {(tenant.metrics?.rating || 0).toFixed(1)}
                                </span>
                              </div>
                            </td>
                            <td className={clsx("px-6", "py-5", "text-right")}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTenant(tenant);
                                }}
                                className={clsx(
                                  "p-2",
                                  "hover:bg-slate-100",
                                  "dark:hover:bg-white/10",
                                  "rounded-lg",
                                  "transition-colors",
                                  "text-slate-400",
                                  "hover:text-primary",
                                )}
                              >
                                <MoreVertical size={18} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {filteredTenants.length === 0 && (
                  <div className={clsx("py-20", "text-center")}>
                    <Store
                      size={48}
                      className={clsx("mx-auto", "text-slate-300", "mb-4")}
                    />
                    <p className={clsx("text-slate-500", "font-medium")}>
                      No tenants found matching your criteria
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Grid View */
              <div
                className={clsx(
                  "grid",
                  "grid-cols-1",
                  "md:grid-cols-2",
                  "lg:grid-cols-3",
                  "xl:grid-cols-4",
                  "gap-6",
                )}
              >
                {filteredTenants.map((tenant) => {
                  const statusConfig =
                    STATUS_CONFIG[tenant.status] || STATUS_CONFIG.INACTIVE;

                  return (
                    <div
                      key={tenant.id}
                      onClick={() => setSelectedTenant(tenant)}
                      className={clsx(
                        "group bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-white/5 p-6 cursor-pointer transition-all hover:shadow-xl hover:border-primary/30",
                        selectedTenant?.id === tenant.id &&
                          "ring-2 ring-primary",
                      )}
                    >
                      <div
                        className={clsx(
                          "flex",
                          "items-start",
                          "justify-between",
                          "mb-4",
                        )}
                      >
                        <div
                          className={clsx(
                            "w-14",
                            "h-14",
                            "rounded-xl",
                            "bg-slate-100",
                            "dark:bg-zinc-800",
                            "flex",
                            "items-center",
                            "justify-center",
                            "text-slate-500",
                            "overflow-hidden",
                          )}
                        >
                          {tenant.logoUrl ? (
                            <img
                              src={tenant.logoUrl}
                              alt=""
                              className={clsx(
                                "w-full",
                                "h-full",
                                "object-cover",
                              )}
                            />
                          ) : (
                            <Store size={24} />
                          )}
                        </div>
                        <span
                          className={clsx(
                            "px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border",
                            statusConfig.bg,
                            statusConfig.text,
                            statusConfig.border,
                          )}
                        >
                          {tenant.status}
                        </span>
                      </div>

                      <h3
                        className={clsx(
                          "font-bold",
                          "text-charcoal",
                          "dark:text-white",
                          "mb-1",
                        )}
                      >
                        {tenant.shopName}
                      </h3>
                      <p className={clsx("text-sm", "text-slate-400", "mb-4")}>
                        {tenant.unitId}
                      </p>

                      <div
                        className={clsx("grid", "grid-cols-2", "gap-3", "mb-4")}
                      >
                        <div
                          className={clsx(
                            "p-3",
                            "bg-slate-50",
                            "dark:bg-white/5",
                            "rounded-xl",
                          )}
                        >
                          <p
                            className={clsx(
                              "text-[9px]",
                              "text-slate-400",
                              "uppercase",
                              "font-bold",
                              "tracking-wider",
                              "mb-1",
                            )}
                          >
                            Rent
                          </p>
                          <p
                            className={clsx(
                              "font-black",
                              "text-charcoal",
                              "dark:text-white",
                            )}
                          >
                            ₱{(tenant.rentCost || 0).toLocaleString()}
                          </p>
                        </div>
                        <div
                          className={clsx(
                            "p-3",
                            "bg-slate-50",
                            "dark:bg-white/5",
                            "rounded-xl",
                          )}
                        >
                          <p
                            className={clsx(
                              "text-[9px]",
                              "text-slate-400",
                              "uppercase",
                              "font-bold",
                              "tracking-wider",
                              "mb-1",
                            )}
                          >
                            Rating
                          </p>
                          <p
                            className={clsx(
                              "font-black",
                              "text-charcoal",
                              "dark:text-white",
                              "flex",
                              "items-center",
                              "gap-1",
                            )}
                          >
                            <Star size={12} className="text-amber-500" />
                            {(tenant.metrics?.rating || 0).toFixed(1)}
                          </p>
                        </div>
                      </div>

                      <div
                        className={clsx(
                          "flex",
                          "items-center",
                          "justify-between",
                          "text-xs",
                          "text-slate-500",
                        )}
                      >
                        <span className={clsx("flex", "items-center", "gap-1")}>
                          <TrendingUp size={12} /> {tenant.metrics?.clicks || 0}{" "}
                          clicks
                        </span>
                        <span
                          className={clsx(
                            "px-2 py-0.5 rounded text-[9px] font-bold uppercase",
                            (
                              PAYMENT_CONFIG[
                                tenant.paymentStatus as keyof typeof PAYMENT_CONFIG
                              ] || PAYMENT_CONFIG["🟢 Cleared"]
                            ).bg,
                            (
                              PAYMENT_CONFIG[
                                tenant.paymentStatus as keyof typeof PAYMENT_CONFIG
                              ] || PAYMENT_CONFIG["🟢 Cleared"]
                            ).text,
                          )}
                        >
                          {tenant.paymentStatus}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Tenant Detail Modal */}
        {selectedTenant && (
          <div
            className={clsx(
              "fixed",
              "inset-0",
              "z-[60]",
              "flex",
              "justify-end",
            )}
          >
            <div
              className={clsx(
                "absolute",
                "inset-0",
                "bg-charcoal/40",
                "dark:bg-black/80",
                "backdrop-blur-md",
                "animate-in",
                "fade-in",
                "duration-300",
              )}
              onClick={() => setSelectedTenant(null)}
            />
            <div
              className={clsx(
                "relative",
                "w-full",
                "max-w-lg",
                "bg-white",
                "dark:bg-zinc-950",
                "border-l",
                "border-slate-200",
                "dark:border-white/10",
                "flex",
                "flex-col",
                "h-full",
                "animate-in",
                "slide-in-from-right",
                "duration-500",
                "shadow-[-40px_0_80px_rgba(0,0,0,0.2)]",
              )}
            >
              {/* Modal Header */}
              <div
                className={clsx(
                  "h-20",
                  "border-b",
                  "border-slate-200",
                  "dark:border-white/5",
                  "flex",
                  "items-center",
                  "justify-between",
                  "px-6",
                  "shrink-0",
                  "bg-slate-50/50",
                  "dark:bg-zinc-900/50",
                )}
              >
                <h2
                  className={clsx(
                    "font-black",
                    "text-lg",
                    "text-charcoal",
                    "dark:text-white",
                    "flex",
                    "items-center",
                    "gap-2",
                  )}
                >
                  <Eye size={18} className="text-primary" />
                  Tenant Details
                </h2>
                <button
                  onClick={() => setSelectedTenant(null)}
                  className={clsx(
                    "p-2",
                    "hover:bg-slate-200",
                    "dark:hover:bg-white/10",
                    "rounded-full",
                    "transition-colors",
                    "text-slate-500",
                  )}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Content */}
              <div
                className={clsx(
                  "flex-1",
                  "overflow-y-auto",
                  "p-6",
                  "space-y-8",
                )}
              >
                {/* Tenant Identity */}
                <div className={clsx("flex", "items-start", "gap-4")}>
                  <div
                    className={clsx(
                      "w-20",
                      "h-20",
                      "rounded-2xl",
                      "bg-slate-100",
                      "dark:bg-zinc-800",
                      "flex",
                      "items-center",
                      "justify-center",
                      "text-slate-500",
                      "overflow-hidden",
                    )}
                  >
                    {selectedTenant.logoUrl ? (
                      <img
                        src={selectedTenant.logoUrl}
                        alt=""
                        className={clsx("w-full", "h-full", "object-cover")}
                      />
                    ) : (
                      <Store size={32} />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3
                      className={clsx(
                        "text-2xl",
                        "font-black",
                        "text-charcoal",
                        "dark:text-white",
                      )}
                    >
                      {selectedTenant.shopName}
                    </h3>
                    <p className={clsx("text-sm", "text-slate-400", "mt-1")}>
                      {selectedTenant.unitId}
                    </p>
                    {selectedTenant.description && (
                      <p
                        className={clsx(
                          "text-xs",
                          "text-slate-500",
                          "mt-2",
                          "leading-relaxed",
                        )}
                      >
                        {selectedTenant.description}
                      </p>
                    )}
                    <div
                      className={clsx("flex", "items-center", "gap-2", "mt-3")}
                    >
                      <span
                        className={clsx(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                          STATUS_CONFIG[selectedTenant.status].bg,
                          STATUS_CONFIG[selectedTenant.status].text,
                          STATUS_CONFIG[selectedTenant.status].border,
                        )}
                      >
                        <span
                          className={clsx(
                            "w-1.5 h-1.5 rounded-full",
                            STATUS_CONFIG[selectedTenant.status].color,
                          )}
                        ></span>
                        {selectedTenant.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className={clsx("grid", "grid-cols-2", "gap-3")}>
                  <button
                    onClick={handleSendMessage}
                    className={clsx(
                      "flex",
                      "flex-col",
                      "items-center",
                      "justify-center",
                      "p-4",
                      "bg-slate-50",
                      "dark:bg-zinc-900",
                      "border",
                      "border-slate-200",
                      "dark:border-white/5",
                      "rounded-2xl",
                      "hover:border-primary",
                      "hover:bg-primary/5",
                      "transition-all",
                      "group",
                    )}
                  >
                    <MessageSquare
                      size={20}
                      className={clsx(
                        "text-slate-400",
                        "group-hover:text-primary",
                        "mb-2",
                        "transition-colors",
                      )}
                    />
                    <span
                      className={clsx(
                        "text-[10px]",
                        "font-bold",
                        "uppercase",
                        "tracking-widest",
                        "text-slate-500",
                        "group-hover:text-primary",
                      )}
                    >
                      Message
                    </span>
                  </button>
                  <button
                    onClick={handlePostMonthlyBill}
                    className={clsx(
                      "flex",
                      "flex-col",
                      "items-center",
                      "justify-center",
                      "p-4",
                      "bg-slate-50",
                      "dark:bg-zinc-900",
                      "border",
                      "border-slate-200",
                      "dark:border-white/5",
                      "rounded-2xl",
                      "hover:border-red-500",
                      "hover:bg-red-500/5",
                      "transition-all",
                      "group",
                    )}
                  >
                    <Receipt
                      size={20}
                      className={clsx(
                        "text-slate-400",
                        "group-hover:text-red-500",
                        "mb-2",
                        "transition-colors",
                      )}
                    />
                    <span
                      className={clsx(
                        "text-[10px]",
                        "font-bold",
                        "uppercase",
                        "tracking-widest",
                        "text-slate-500",
                        "group-hover:text-red-500",
                      )}
                    >
                      Bill
                    </span>
                  </button>
                </div>

                {/* Contract Info */}
                <div>
                  <h4
                    className={clsx(
                      "text-[10px]",
                      "font-black",
                      "uppercase",
                      "tracking-[0.2em]",
                      "text-slate-400",
                      "mb-4",
                      "flex",
                      "items-center",
                      "gap-2",
                    )}
                  >
                    <Calendar size={14} /> Contract Details
                  </h4>
                  <div
                    className={clsx(
                      "bg-slate-50",
                      "dark:bg-zinc-900",
                      "rounded-2xl",
                      "border",
                      "border-slate-200",
                      "dark:border-white/5",
                      "p-5",
                      "space-y-4",
                    )}
                  >
                    <div
                      className={clsx(
                        "flex",
                        "items-center",
                        "justify-between",
                      )}
                    >
                      <span
                        className={clsx(
                          "text-xs",
                          "font-bold",
                          "text-slate-600",
                          "dark:text-slate-300",
                        )}
                      >
                        Start Date
                      </span>
                      <span
                        className={clsx(
                          "text-sm",
                          "font-black",
                          "text-charcoal",
                          "dark:text-white",
                        )}
                      >
                        {selectedTenant.contractStart}
                      </span>
                    </div>
                    <div
                      className={clsx(
                        "h-px",
                        "w-full",
                        "bg-slate-200",
                        "dark:bg-white/5",
                      )}
                    ></div>
                    <div
                      className={clsx(
                        "flex",
                        "items-center",
                        "justify-between",
                      )}
                    >
                      <span
                        className={clsx(
                          "text-xs",
                          "font-bold",
                          "text-slate-600",
                          "dark:text-slate-300",
                        )}
                      >
                        End Date
                      </span>
                      <span
                        className={clsx(
                          "text-sm",
                          "font-black",
                          "text-charcoal",
                          "dark:text-white",
                        )}
                      >
                        {selectedTenant.contractEnd}
                      </span>
                    </div>
                    <div
                      className={clsx(
                        "h-px",
                        "w-full",
                        "bg-slate-200",
                        "dark:bg-white/5",
                      )}
                    ></div>
                    <div
                      className={clsx(
                        "flex",
                        "items-center",
                        "justify-between",
                      )}
                    >
                      <span
                        className={clsx(
                          "text-xs",
                          "font-bold",
                          "text-slate-600",
                          "dark:text-slate-300",
                        )}
                      >
                        Monthly Rent
                      </span>
                      <span
                        className={clsx(
                          "text-sm",
                          "font-black",
                          "text-charcoal",
                          "dark:text-white",
                        )}
                      >
                        ₱{(selectedTenant.rentCost || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div>
                  <h4
                    className={clsx(
                      "text-[10px]",
                      "font-black",
                      "uppercase",
                      "tracking-[0.2em]",
                      "text-slate-400",
                      "mb-4",
                      "flex",
                      "items-center",
                      "gap-2",
                    )}
                  >
                    <BarChart3 size={14} /> Performance Metrics
                  </h4>
                  <div className={clsx("grid", "grid-cols-2", "gap-4")}>
                    <div
                      className={clsx(
                        "bg-slate-50",
                        "dark:bg-zinc-900",
                        "rounded-2xl",
                        "border",
                        "border-slate-200",
                        "dark:border-white/5",
                        "p-4",
                      )}
                    >
                      <p
                        className={clsx(
                          "text-[10px]",
                          "text-slate-400",
                          "uppercase",
                          "font-bold",
                          "tracking-widest",
                          "mb-2",
                        )}
                      >
                        Ad Clicks
                      </p>
                      <p
                        className={clsx(
                          "text-2xl",
                          "font-black",
                          "text-charcoal",
                          "dark:text-white",
                        )}
                      >
                        {selectedTenant.metrics?.clicks || 0}
                      </p>
                    </div>
                    <div
                      className={clsx(
                        "bg-slate-50",
                        "dark:bg-zinc-900",
                        "rounded-2xl",
                        "border",
                        "border-slate-200",
                        "dark:border-white/5",
                        "p-4",
                      )}
                    >
                      <p
                        className={clsx(
                          "text-[10px]",
                          "text-slate-400",
                          "uppercase",
                          "font-bold",
                          "tracking-widest",
                          "mb-2",
                        )}
                      >
                        Offers Claimed
                      </p>
                      <p
                        className={clsx(
                          "text-2xl",
                          "font-black",
                          "text-charcoal",
                          "dark:text-white",
                        )}
                      >
                        {selectedTenant.metrics?.offersClaimed || 0}
                      </p>
                    </div>
                    <div
                      className={clsx(
                        "bg-slate-50",
                        "dark:bg-zinc-900",
                        "rounded-2xl",
                        "border",
                        "border-slate-200",
                        "dark:border-white/5",
                        "p-4",
                      )}
                    >
                      <p
                        className={clsx(
                          "text-[10px]",
                          "text-slate-400",
                          "uppercase",
                          "font-bold",
                          "tracking-widest",
                          "mb-2",
                        )}
                      >
                        Rating
                      </p>
                      <p
                        className={clsx(
                          "text-2xl",
                          "font-black",
                          "text-charcoal",
                          "dark:text-white",
                          "flex",
                          "items-center",
                          "gap-1",
                        )}
                      >
                        <Star size={18} className="text-amber-500" />
                        {(selectedTenant.metrics?.rating || 0).toFixed(1)}
                      </p>
                    </div>
                    <div
                      className={clsx(
                        "bg-slate-50",
                        "dark:bg-zinc-900",
                        "rounded-2xl",
                        "border",
                        "border-slate-200",
                        "dark:border-white/5",
                        "p-4",
                      )}
                    >
                      <p
                        className={clsx(
                          "text-[10px]",
                          "text-slate-400",
                          "uppercase",
                          "font-bold",
                          "tracking-widest",
                          "mb-2",
                        )}
                      >
                        Inquiries
                      </p>
                      <p
                        className={clsx(
                          "text-2xl",
                          "font-black",
                          "text-charcoal",
                          "dark:text-white",
                        )}
                      >
                        {selectedTenant.metrics?.inquiries || 0}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Violations */}
                {selectedTenant.violations && selectedTenant.violations > 0 && (
                  <div
                    className={clsx(
                      "bg-red-50",
                      "dark:bg-red-900/10",
                      "border",
                      "border-red-200",
                      "dark:border-red-900/30",
                      "rounded-2xl",
                      "p-4",
                    )}
                  >
                    <div
                      className={clsx(
                        "flex",
                        "items-center",
                        "gap-2",
                        "text-red-600",
                        "mb-2",
                      )}
                    >
                      <AlertTriangle size={16} />
                      <span
                        className={clsx(
                          "text-xs",
                          "font-bold",
                          "uppercase",
                          "tracking-widest",
                        )}
                      >
                        Violations
                      </span>
                    </div>
                    <p
                      className={clsx("text-2xl", "font-black", "text-red-600")}
                    >
                      {selectedTenant.violations}
                    </p>
                  </div>
                )}

                {/* Financial Intelligence & Ledger */}
                <div>
                  <h4
                    className={clsx(
                      "text-[10px]",
                      "font-black",
                      "uppercase",
                      "tracking-[0.2em]",
                      "text-slate-400",
                      "mb-4",
                      "flex",
                      "items-center",
                      "gap-2",
                    )}
                  >
                    <PhilippinePeso size={14} /> Financial Logistics
                  </h4>

                  <div className="space-y-4">
                    {/* Summary Row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">
                          Total Paid
                        </p>
                        <p className="text-lg font-black text-charcoal dark:text-white">
                          ₱
                          {allInvoices
                            .filter(
                              (i) =>
                                i.tenantId === selectedTenant.id &&
                                i.status === "PAID",
                            )
                            .reduce((sum, i) => sum + i.amount, 0)
                            .toLocaleString()}
                        </p>
                      </div>
                      <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                        <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">
                          Outstanding
                        </p>
                        <p className="text-lg font-black text-charcoal dark:text-white">
                          ₱
                          {allInvoices
                            .filter(
                              (i) =>
                                i.tenantId === selectedTenant.id &&
                                i.status !== "PAID",
                            )
                            .reduce((sum, i) => sum + i.amount, 0)
                            .toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div
                      className={clsx(
                        "bg-slate-50",
                        "dark:bg-zinc-900",
                        "rounded-2xl",
                        "border",
                        "border-slate-200",
                        "dark:border-white/5",
                        "overflow-hidden",
                      )}
                    >
                      <div className="p-4 border-b border-slate-200 dark:border-white/5 bg-slate-100/50 dark:bg-white/5">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          Recent Ledger Items
                        </span>
                      </div>

                      <div className="divide-y divide-slate-200 dark:divide-white/5 max-h-[400px] overflow-y-auto">
                        {allInvoices.filter(
                          (i) => i.tenantId === selectedTenant.id,
                        ).length > 0 ? (
                          allInvoices
                            .filter((i) => i.tenantId === selectedTenant.id)
                            .map((inv: any) => (
                              <div
                                key={inv.id}
                                className="p-4 flex flex-col gap-3 group hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={clsx(
                                        "w-8 h-8 rounded-lg flex items-center justify-center",
                                        inv.status === "PAID"
                                          ? "bg-emerald-500/10 text-emerald-500"
                                          : "bg-amber-500/10 text-amber-500",
                                      )}
                                    >
                                      <PaymentIcon size={14} />
                                    </div>
                                    <div>
                                      <p className="text-xs font-black text-charcoal dark:text-white uppercase tracking-tight">
                                        {inv.invoiceNumber}
                                      </p>
                                      <p className="text-[9px] font-bold text-slate-400 uppercase">
                                        {inv.month} • Due{" "}
                                        {new Date(
                                          inv.dueDate,
                                        ).toLocaleDateString()}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs font-black text-charcoal dark:text-white">
                                      ₱{inv.amount.toLocaleString()}
                                    </p>
                                    <span
                                      className={clsx(
                                        "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded",
                                        inv.status === "PAID"
                                          ? "bg-emerald-500/20 text-emerald-600"
                                          : inv.status === "OVERDUE"
                                            ? "bg-red-500/20 text-red-600"
                                            : "bg-amber-500/20 text-amber-600",
                                      )}
                                    >
                                      {inv.status}
                                    </span>
                                  </div>
                                </div>

                                {inv.status === "REVIEWING" &&
                                  inv.depositSlipUrl && (
                                    <div className="flex items-center gap-2 p-2 bg-amber-500/5 border border-amber-500/10 rounded-xl mt-2">
                                      <a
                                        href={inv.depositSlipUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 px-3 py-2 bg-white dark:bg-zinc-800 text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 border border-slate-200 dark:border-white/5"
                                      >
                                        <Eye size={12} /> View Slip
                                      </a>
                                      <button
                                        onClick={async () => {
                                          try {
                                            setToast({
                                              msg: "Processing approval...",
                                              type: "success",
                                            });
                                            const res =
                                              await updateInvoiceStatus(
                                                inv.id,
                                                "PAID",
                                              );
                                            if (res.success) {
                                              setToast({
                                                msg: "Payment Cleared!",
                                                type: "success",
                                              });
                                              loadTenants();
                                            } else {
                                              setToast({
                                                msg: "Error: " + res.error,
                                                type: "error",
                                              });
                                            }
                                          } catch (e: any) {
                                            alert(e.message);
                                          }
                                        }}
                                        className="flex-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-md shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-1.5"
                                      >
                                        <CheckCircle size={12} /> Approve
                                      </button>
                                    </div>
                                  )}

                                {(inv.status === "PENDING" ||
                                  inv.status === "OVERDUE") && (
                                  <div className="mt-2 text-right">
                                    <button
                                      onClick={async () => {
                                        const refNo = window.prompt(
                                          "Record Cash Payment\nEnter physical receipt/reference number:",
                                        );
                                        if (!refNo) return;

                                        setToast({
                                          msg: "Recording payment...",
                                          type: "success",
                                        });
                                        const res =
                                          await recordManualPaymentAction(
                                            inv.id,
                                            refNo,
                                          );
                                        if (res.success) {
                                          setToast({
                                            msg: "Payment physically recorded!",
                                            type: "success",
                                          });
                                          loadTenants();
                                        } else {
                                          setToast({
                                            msg: "Error: " + res.error,
                                            type: "error",
                                          });
                                        }
                                      }}
                                      className="px-4 py-2 bg-[#BE1E2D] hover:bg-[#a01825] text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-md shadow-red-500/20 transition-all hover:scale-105 active:scale-95 inline-flex items-center gap-1.5"
                                    >
                                      <PhilippinePeso size={12} /> Record Cash
                                      Payment
                                    </button>
                                  </div>
                                )}

                                {inv.status === "PAID" && inv.referenceNo && (
                                  <div className="mt-1 flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase">
                                    <FileText size={10} /> Ref:{" "}
                                    {inv.referenceNo}
                                  </div>
                                )}
                              </div>
                            ))
                        ) : (
                          <div className="p-10 text-center text-slate-400">
                            <PaymentIcon
                              size={32}
                              className="mx-auto mb-3 opacity-20"
                            />
                            <p className="text-[10px] font-black uppercase tracking-widest">
                              No ledger items found
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Account Security & Compliance */}
                <div className="pt-4 border-t border-slate-200 dark:border-white/5">
                  <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
                        <ShieldCheck size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                          Compliance Status
                        </p>
                        <p className="text-sm font-black text-white uppercase italic">
                          Verified Authority
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
                      <CheckCircle size={10} />
                      <span className="text-[9px] font-black uppercase">
                        Secure
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Approval Section for PENDING tenants */}
              {selectedTenant.status === "PENDING" && (
                <div
                  className={clsx(
                    "p-6",
                    "border-t",
                    "border-amber-200",
                    "dark:border-amber-900/30",
                    "bg-amber-50",
                    "dark:bg-amber-900/10",
                    "shrink-0",
                    "space-y-4",
                  )}
                >
                  <div
                    className={clsx(
                      "flex",
                      "items-center",
                      "gap-2",
                      "text-amber-700",
                      "dark:text-amber-400",
                    )}
                  >
                    <CheckCircle size={18} />
                    <span
                      className={clsx(
                        "font-bold",
                        "text-sm",
                        "uppercase",
                        "tracking-wider",
                      )}
                    >
                      Approve Application
                    </span>
                  </div>
                  <p
                    className={clsx(
                      "text-xs",
                      "text-slate-600",
                      "dark:text-slate-400",
                    )}
                  >
                    Assign a Unit ID to approve this merchant. This will change
                    their account role to TENANT.
                  </p>
                  <select
                    value={selectedUnitForApproval}
                    onChange={(e) => setSelectedUnitForApproval(e.target.value)}
                    className={clsx(
                      "w-full",
                      "p-3",
                      "bg-white",
                      "dark:bg-zinc-800",
                      "border",
                      "border-slate-200",
                      "dark:border-white/10",
                      "rounded-xl",
                      "text-sm",
                      "focus:ring-2",
                      "focus:ring-primary",
                      "focus:border-primary",
                    )}
                  >
                    <option value="">Select Unit ID...</option>
                    {availableSlots.map((slot) => (
                      <option key={slot.unit_id} value={slot.unit_id}>
                        {slot.unit_id} - {slot.sqm_size} sqm
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleApproveTenant(selectedTenant.id)}
                    disabled={
                      isApproving === selectedTenant.id ||
                      !selectedUnitForApproval
                    }
                    className={clsx(
                      "w-full",
                      "py-3",
                      "font-black",
                      "text-xs",
                      "uppercase",
                      "tracking-widest",
                      "rounded-xl",
                      "transition-all",
                      "flex",
                      "items-center",
                      "justify-center",
                      "gap-2",
                      isApproving === selectedTenant.id ||
                        !selectedUnitForApproval
                        ? "bg-slate-200 dark:bg-zinc-700 text-slate-400 cursor-not-allowed"
                        : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg hover:scale-[1.02]",
                    )}
                  >
                    {isApproving === selectedTenant.id ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />{" "}
                        Approving...
                      </>
                    ) : (
                      <>
                        <CheckCircle size={16} /> Approve & Assign Unit
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Modal Footer */}
              <div
                className={clsx(
                  "p-6",
                  "border-t",
                  "border-slate-200",
                  "dark:border-white/5",
                  "bg-slate-50",
                  "dark:bg-zinc-900",
                  "shrink-0",
                  "space-y-3",
                )}
              >
                <div className={clsx("flex", "gap-3")}>
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className={clsx(
                      "flex-1",
                      "h-14",
                      "bg-white",
                      "dark:bg-white/5",
                      "text-slate-600",
                      "dark:text-white",
                      "border",
                      "border-slate-200",
                      "dark:border-white/10",
                      "rounded-2xl",
                      "font-black",
                      "text-[10px]",
                      "uppercase",
                      "tracking-[0.2em]",
                      "hover:bg-slate-50",
                      "dark:hover:bg-white/10",
                      "transition-colors",
                      "flex",
                      "items-center",
                      "justify-center",
                      "gap-2",
                    )}
                  >
                    <Edit size={16} /> Edit Profile
                  </button>
                  <button
                    onClick={handlePostMonthlyBill}
                    className={clsx(
                      "flex-1",
                      "h-14",
                      "bg-[#BE1E2D]",
                      "text-white",
                      "rounded-2xl",
                      "font-black",
                      "text-[10px]",
                      "uppercase",
                      "tracking-[0.2em]",
                      "hover:bg-[#a01825]",
                      "transition-colors",
                      "flex",
                      "items-center",
                      "justify-center",
                      "gap-2",
                      "shadow-lg",
                      "shadow-red-500/20",
                    )}
                  >
                    <Receipt size={16} /> Post Monthly Bill
                  </button>
                </div>
                <div className={clsx("grid", "grid-cols-2", "gap-3")}>
                  <button
                    onClick={handleViewDocuments}
                    className={clsx(
                      "py-2.5",
                      "bg-white",
                      "dark:bg-zinc-800",
                      "border",
                      "border-slate-200",
                      "dark:border-white/10",
                      "text-slate-600",
                      "dark:text-slate-300",
                      "font-bold",
                      "text-[10px]",
                      "uppercase",
                      "tracking-widest",
                      "rounded-xl",
                      "hover:bg-slate-50",
                      "dark:hover:bg-zinc-700",
                      "transition-colors",
                      "flex",
                      "items-center",
                      "justify-center",
                      "gap-2",
                    )}
                  >
                    <FileText size={14} /> Documents
                  </button>
                  <button
                    onClick={() => handleDeleteTenant(selectedTenant.id)}
                    className={clsx(
                      "py-2.5",
                      "bg-red-50",
                      "dark:bg-red-900/10",
                      "border",
                      "border-red-200",
                      "dark:border-red-900/30",
                      "text-red-600",
                      "font-bold",
                      "text-[10px]",
                      "uppercase",
                      "tracking-widest",
                      "rounded-xl",
                      "hover:bg-red-100",
                      "dark:hover:bg-red-900/20",
                      "transition-colors",
                      "flex",
                      "items-center",
                      "justify-center",
                      "gap-2",
                    )}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
