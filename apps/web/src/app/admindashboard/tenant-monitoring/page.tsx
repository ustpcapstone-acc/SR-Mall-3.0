"use client";

import { PaymentLedgerDialog } from "@/components/payments/payment-ledger-dialog";
import React, { useState, useEffect, useRef } from "react";
import { Button, Input, InputArea, Loader, Select, Table, cn } from "@cloudflare/kumo";
import {
  CaretLeft,
  CaretRight,
  CaretUpDown,
  ChatCircle,
  DownloadSimple,
  FileText,
  ListDashes,
  Receipt,
  SquaresFour,
  Trash,
  UserPlus,
} from "@phosphor-icons/react";
import { AdminDialog, AdminPage, EmptyNote, Panel, Person, SearchField, Stat, StatRow, PageTabs } from "@/components/admin/page-kit";
import { useAuth } from "@/app/providers";
import { CheckCircle, Edit, RefreshCw, X, AlertTriangle } from "lucide-react";
import { formatPHDate } from "@/lib/ph-date";
import { rentOf, type RentLease } from "@/lib/tenant-rent";
import { RegisterTenantModal } from "@/components/admin/register-tenant-modal";
import { RecordCashPaymentModal } from "@/components/admin/record-cash-payment-modal";
import { RecordPaymentGuide } from "@/components/admin/record-payment-guide";
import clsx from "clsx";
import {
  getAllTenantsAction,
  deleteTenantAction,
  approveTenantAction,
  getTenantReportDataAction,
  adminUpdateTenantAction,
} from "@/app/actions/tenant";
import { getOrCreateAdminConversationForTenantAction } from "@/app/actions/chat-queries";
import {
  generateVoucherPDF,
  generateTenantReceiptPDF,
  generateTenantPDF,
} from "@/utils/report-generator";
// Dynamic import used in handler to prevent SSR issues
import { getAreaSlots } from "@/app/actions/space-slot";
import {
  getAllInvoices,
  generateInvoice,
  updateInvoiceStatus,
} from "@/app/actions/finance";

interface Tenant {
  id: string;
  shopName: string;
  unitId: string;
  description?: string;
  logoUrl?: string;
  isOpen: boolean;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING" | "REJECTED" | "PAST";
  metrics?: {
    rating: number;
    inquiries: number;
  };
  user?: {
    id: string;
    email: string;
    name: string;
  };
  category?: string;
  /** Active leases, oldest first, and what they add up to (see lib/tenant-rent). */
  leases: RentLease[];
  units: string[];
  sqm: number;
  rentSource: "lease" | "listed" | "none";
  contractStart?: string;
  contractEnd?: string;
  rentCost?: number;
  paymentStatus?: string;
  /** A deposit slip is waiting to be checked, even if another bill is overdue. */
  hasSlipToVerify?: boolean;
  violations?: number;
  avgRating?: number;
  reviewCount?: number;
  nextDueDate?: string;
  nextDueAt?: string | null;
}

const STATUS_TEXT: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "text-kumo-success" },
  PENDING: { label: "Waiting for approval", className: "text-kumo-warning" },
  INACTIVE: { label: "Inactive", className: "text-kumo-subtle" },
  SUSPENDED: { label: "Suspended", className: "text-kumo-danger" },
  REJECTED: { label: "Rejected", className: "text-kumo-danger" },
  PAST: { label: "Past tenant", className: "text-kumo-subtle" },
};

// These exact strings are how a tenant's payment state is stored on this page.
const CLEARED = "🟢 Cleared";
const VERIFYING = "🟡 Pending Verification";
const OVERDUE = "🔴 Overdue";
const PAYMENT_TEXT: Record<string, { label: string; className: string }> = {
  [CLEARED]: { label: "Cleared", className: "text-kumo-success" },
  [VERIFYING]: { label: "Verifying", className: "text-kumo-warning" },
  [OVERDUE]: { label: "Overdue", className: "text-kumo-danger" },
  PENDING: { label: "Bill pending", className: "text-kumo-default" },
};
const paymentOf = (status?: string) => PAYMENT_TEXT[status ?? CLEARED] ?? PAYMENT_TEXT[CLEARED];

const STATUS_FILTERS: Record<string, string> = {
  all: "All current",
  ACTIVE: "Active",
  PENDING: "Pending",
  INACTIVE: "Inactive",
  SUSPENDED: "Suspended",
  REJECTED: "Rejected",
  PAST: "Past tenants",
};
const PAYMENT_FILTERS: Record<string, string> = {
  all: "All payments",
  [CLEARED]: "Cleared",
  [VERIFYING]: "Verifying",
  [OVERDUE]: "Overdue",
  PENDING: "Bill pending",
};
const PERIODS: Record<string, string> = { daily: "Today", weekly: "Last 7 days", monthly: "Last 30 days", yearly: "This year" };
const PAGE_SIZES: Record<string, string> = { "8": "8", "12": "12", "24": "24", "48": "48" };
const YEARS: Record<string, string> = Object.fromEntries([2024, 2025, 2026, 2027, 2028].map((y) => [String(y), String(y)]));

const UNASSIGNED_UNIT = "PENDING_ASSIGNMENT";

type Timeframe = "daily" | "weekly" | "monthly" | "yearly";

const getTimeframeMultiplier = (tf: Timeframe) => {
  switch (tf) {
    case "daily":
      return 1 / 30;
    case "weekly":
      return 7 / 30;
    case "monthly":
      return 1;
    case "yearly":
      return 12;
  }
};

const getTimeframeDetails = (tf: Timeframe) => {
  switch (tf) {
    case "daily":
      return {
        label: "Daily (Today)",
        shortLabel: "Daily",
        periodBadge: "Today",
        rentColumnTitle: "Daily Rent (Est.)",
        revHeaderLabel: "Daily Est.",
        unitSuffix: "/day",
      };
    case "weekly":
      return {
        label: "Weekly (7 Days)",
        shortLabel: "Weekly",
        periodBadge: "This Week",
        rentColumnTitle: "Weekly Rent (Est.)",
        revHeaderLabel: "Weekly Est.",
        unitSuffix: "/wk",
      };
    case "monthly":
      return {
        label: "Monthly (30 Days)",
        shortLabel: "Monthly",
        periodBadge: "This Month",
        rentColumnTitle: "Monthly Rent",
        revHeaderLabel: "Monthly Est.",
        unitSuffix: "/mo",
      };
    case "yearly":
      return {
        label: "Yearly (Annual)",
        shortLabel: "Yearly",
        periodBadge: "This Year",
        rentColumnTitle: "Annual Rent (Est.)",
        revHeaderLabel: "Annual Est.",
        unitSuffix: "/yr",
      };
  }
};

export default function TenantMonitoring() {
  const { user: adminUser } = useAuth();
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [timeframe, setTimeframe] = useState<Timeframe>("monthly");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  // `loading` = first load only (full-page spinner). Background refreshes are
  // silent, and modal buttons use `saving`, so a refresh never blanks the list
  // or disables Save / Post Bill.
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const loadInFlightRef = useRef(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  // Which tab of the tenant window is open. A tenant with a deposit slip
  // waiting opens on Payments, where the slip is checked.
  const [tabChoice, setTabChoice] = useState<{ id: string; tab: "details" | "payments" } | null>(null);
  const detailTab =
    tabChoice && tabChoice.id === selectedTenant?.id
      ? tabChoice.tab
      : selectedTenant?.hasSlipToVerify
        ? "payments"
        : "details";
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
  // The dashboard's "Deposit slips to verify" shortcut opens the filtered list.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("payment") === "verifying") {
      setPaymentFilter("🟡 Pending Verification");
    }
  }, []);
  const [sortBy, setSortBy] = useState<"name" | "status" | "rent">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  // Client-side pagination for the tenant directory.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    pending: 0,
    overdue: 0,
    paidTenants: 0,
    totalRevenue: 0,
    collectedRevenue: 0,
    pendingRevenue: 0,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [reportMonth, setReportMonth] = useState(new Date().getMonth());
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [reportYearFilter, setReportYearFilter] = useState(new Date().getFullYear());
  const [isReportOpen, setIsReportOpen] = useState(false);
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
  const [isDocumentsModalOpen, setIsDocumentsModalOpen] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);
  const [isDeletingTenant, setIsDeletingTenant] = useState(false);
  const [generatingDoc, setGeneratingDoc] = useState<string | null>(null);

  const loadTenants = async (silent = true) => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    if (!silent) setLoading(true);
    try {
      const [result, invoicesResult, slotsResult] = await Promise.all([
        getAllTenantsAction(),
        getAllInvoices(),
        getAreaSlots(),
      ]);

      // Every unit (not just AVAILABLE ones): a tenant's own unit is OCCUPIED.
      const allSlots: any[] =
        slotsResult.success && slotsResult.data ? slotsResult.data : [];
      if (allSlots.length > 0) {
        setAvailableSlots(allSlots.filter((s: any) => s.status === "AVAILABLE"));
      }

      if (result.success && result.data) {

        const enhancedTenants: Tenant[] = result.data.map(
          (item: any) => {
            const tenantInvoices = invoicesResult.filter(
              (inv: any) => inv.tenantId === item.id,
            );

            const hasSlipToVerify = tenantInvoices.some((inv: any) => inv.status === "REVIEWING");
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

            const rent = rentOf(item, allSlots);

            return {
              ...item,
              leases: rent.leases,
              units: rent.units,
              sqm: rent.sqm,
              rentSource: rent.source,
              contractStart: rent.startDate ? formatPHDate(rent.startDate) : undefined,
              contractEnd: rent.paidThrough ? formatPHDate(rent.paidThrough) : undefined,
              description: item.description || "No store description provided.",
              rentCost: rent.monthlyRent,
              paymentStatus,
              hasSlipToVerify,
              nextDueDate,
              nextDueAt: nextInv?.dueDate ? new Date(nextInv.dueDate).toISOString() : null,
              metrics: {
                rating: item.avgRating || 0,
                inquiries: item.reviewCount || 0,
              },
            };
          },
        );

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
            (tenant: Tenant) => tenant.paymentStatus === "🔴 Overdue",
          ).length,
          paidTenants: enhancedTenants.filter((tenant: Tenant) => {
            const tInvoices = invoicesResult.filter(
              (inv: any) => inv.tenantId === tenant.id,
            );
            return (
              tInvoices.some((inv: any) => inv.status === "PAID") ||
              (tenant.paymentStatus === "🟢 Cleared" && tenant.status === "ACTIVE")
            );
          }).length,
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
    } finally {
      loadInFlightRef.current = false;
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants(false);

    // Quiet background refresh every 60s, skipped while the tab is hidden,
    // plus an immediate refresh when the admin comes back to the tab.
    const interval = setInterval(() => {
      if (!document.hidden) loadTenants();
    }, 60000);
    const onVisible = () => {
      if (!document.hidden) loadTenants();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
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
    setSaving(true);
    try {
      const res = await adminUpdateTenantAction(editingTenant.id, editFormData, adminUser?.id);
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
      setSaving(false);
    }
  };

  const handleViewDocuments = () => {
    if (!selectedTenant) return;
    setIsDocumentsModalOpen(true);
  };

  const handleSendMessage = async () => {
    if (!selectedTenant) return;
    try {
      const res = await getOrCreateAdminConversationForTenantAction(selectedTenant.id);
      if (res.success && res.conversationId) {
        window.location.href = `/admindashboard/messenger-hub?conversationId=${res.conversationId}&tenantId=${selectedTenant.id}`;
      } else {
        window.location.href = `/admindashboard/messenger-hub?tenantId=${selectedTenant.id}`;
      }
    } catch {
      window.location.href = `/admindashboard/messenger-hub?tenantId=${selectedTenant.id}`;
    }
  };

  const handleConfirmDelete = async () => {
    if (!tenantToDelete) return;
    setIsDeletingTenant(true);
    try {
      const result = await deleteTenantAction(tenantToDelete.id, adminUser?.id);
      if (result.success) {
        setToast({
          msg: `✓ ${tenantToDelete.shopName} deleted successfully`,
          type: "success",
        });
        setTenantToDelete(null);
        setSelectedTenant(null);
        loadTenants();
        loadAvailableSlots();
      } else {
        setToast({
          msg: result.error || "Failed to delete tenant",
          type: "error",
        });
      }
    } catch (error: any) {
      setToast({
        msg: error.message || "Error deleting tenant",
        type: "error",
      });
    } finally {
      setIsDeletingTenant(false);
    }
  };

  const handleDownloadVoucher = async (tenant: Tenant, lease: RentLease) => {
    try {
      setGeneratingDoc(`voucher-${lease.unitId}`);
      await generateVoucherPDF({
        shopName: tenant.shopName,
        category: tenant.category || "Other",
        email: tenant.user?.email || "Not recorded",
        tempPass: "••••••••",
        slotId: lease.unitId,
        rentCost: lease.monthlyRent,
        startDate: formatPHDate(lease.startDate),
        endDate: formatPHDate(lease.endDate),
      });
      setToast({ msg: "✓ Lease agreement voucher downloaded", type: "success" });
    } catch (e: any) {
      console.error("Voucher download error:", e);
      setToast({ msg: "Could not generate voucher PDF", type: "error" });
    } finally {
      setGeneratingDoc(null);
    }
  };

  const handleDownloadReceipt = async (inv: any, tenant: Tenant) => {
    try {
      setGeneratingDoc(`receipt-${inv.id}`);
      await generateTenantReceiptPDF(inv, tenant);
      setToast({ msg: "✓ Official receipt downloaded", type: "success" });
    } catch (e: any) {
      console.error("Receipt download error:", e);
      setToast({ msg: "Could not generate receipt PDF", type: "error" });
    } finally {
      setGeneratingDoc(null);
    }
  };

  const handleDownloadTenantSummary = async (tenant: Tenant) => {
    try {
      setGeneratingDoc("summary");
      await generateTenantPDF([
        {
          shopName: tenant.shopName,
          tenantOwner: tenant.user?.name || tenant.user?.email || "N/A",
          category: tenant.category || "Other",
          unitId: tenant.units.join(", ") || tenant.unitId,
          monthlyRent: tenant.rentCost || 0,
          balance: allInvoices
            .filter((i: any) => i.tenantId === tenant.id && i.status !== "PAID")
            .reduce((sum: number, i: any) => sum + i.amount, 0),
          status: tenant.status,
          nextDueDate: tenant.nextDueAt,
          leaseExpiryDate: tenant.leases.length ? tenant.contractEnd : null,
          sqmSize: tenant.sqm,
        },
      ]);
      setToast({ msg: "✓ Tenant report downloaded", type: "success" });
    } catch (e: any) {
      console.error("Report download error:", e);
      setToast({ msg: "Could not generate tenant report PDF", type: "error" });
    } finally {
      setGeneratingDoc(null);
    }
  };

  const handlePostMonthlyBill = () => {
    if (!selectedTenant) return;
    setBillFormData({
      // A bill without a unit is recorded against the first one.
      amount: selectedTenant.leases[0]?.monthlyRent ?? selectedTenant.rentCost ?? 0,
      month: new Date().toLocaleString("default", { month: "short", year: "numeric" }),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      description: "Manual Billing - Rent & Utilities",
    });
    setIsBillModalOpen(true);
  };

  // Record Cash Payment modal (components/admin/record-cash-payment-modal)
  const [cashPaymentInvoice, setCashPaymentInvoice] = useState<any | null>(null);
  const openCashPaymentModal = (invoice: any) => setCashPaymentInvoice(invoice);

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

    setSaving(true);
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
      setSaving(false);
    }
  };

  const MONTH_NAMES = [
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

  const handleExportMonthlyReport = async () => {
    setIsExporting(true);
    try {
      const { generateTenantPDF } = await import("@/utils/report-generator");
      const result = await getTenantReportDataAction({
        month: reportMonth,
        year: reportYear,
      });
      if (result.success && result.data) {
        const monthLabel = MONTH_NAMES[reportMonth];
        await generateTenantPDF(
          result.data,
          `Tenant Summary Report, ${monthLabel} ${reportYear}`,
          `Tenant_Report_${monthLabel}_${reportYear}.pdf`,
        );
        setToast({
          msg: `Monthly report for ${monthLabel} ${reportYear} downloaded!`,
          type: "success",
        });
      } else {
        setToast({
          msg: result.error || "Failed to generate monthly report",
          type: "error",
        });
      }
    } catch (error) {
      console.error("Export error:", error);
      setToast({ msg: "Error generating monthly report", type: "error" });
    } finally {
      setIsExporting(false);
      setIsReportOpen(false);
    }
  };

  const handleExportYearlyReport = async () => {
    setIsExporting(true);
    try {
      const { generateTenantPDF } = await import("@/utils/report-generator");
      const result = await getTenantReportDataAction({
        year: reportYearFilter,
      });
      if (result.success && result.data) {
        await generateTenantPDF(
          result.data,
          `Annual Tenant Summary Report, ${reportYearFilter}`,
          `Tenant_Report_Annual_${reportYearFilter}.pdf`,
        );
        setToast({
          msg: `Annual report for ${reportYearFilter} downloaded!`,
          type: "success",
        });
      } else {
        setToast({
          msg: result.error || "Failed to generate yearly report",
          type: "error",
        });
      }
    } catch (error) {
      console.error("Export error:", error);
      setToast({ msg: "Error generating yearly report", type: "error" });
    } finally {
      setIsExporting(false);
      setIsReportOpen(false);
    }
  };

  const handleExportReport = async () => {
    setIsExporting(true);
    try {
      const { generateTenantPDF } = await import("@/utils/report-generator");
      const result = await getTenantReportDataAction();
      if (result.success && result.data) {
        await generateTenantPDF(
          result.data,
          "All-Time Tenant Summary Report",
          `Tenant_Report_Overall_${new Date().toISOString().split("T")[0]}.pdf`,
        );
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
      setIsReportOpen(false);
    }
  };

  const filteredTenants = tenants
    .filter((t) => {
      const matchesSearch =
        t.shopName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        [t.unitId, ...t.units].some((u) => u?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        t.user?.email?.toLowerCase().includes(searchQuery.toLowerCase());
      // "all" excludes PAST tenants and REJECTED applicants — pick them
      // explicitly from the status filter to see them.
      const matchesStatus =
        statusFilter === "all"
          ? t.status !== "PAST" && t.status !== "REJECTED"
          : t.status === statusFilter;
      const matchesPayment =
        paymentFilter === "all" ||
        t.paymentStatus === paymentFilter ||
        (paymentFilter === "🟡 Pending Verification" && !!t.hasSlipToVerify);
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

  // Keep the current page valid as filters/search change the result count.
  const totalPages = Math.max(1, Math.ceil(filteredTenants.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const paginatedTenants = filteredTenants.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, paymentFilter, sortBy, sortOrder, pageSize, viewMode]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageNumbers = (() => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i += 1) pages.push(i);
      return pages;
    }
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    pages.push(1);
    if (start > 2) pages.push("ellipsis");
    for (let i = start; i <= end; i += 1) pages.push(i);
    if (end < totalPages - 1) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
  })();

  const multiplier = getTimeframeMultiplier(timeframe);
  const tfDetails = getTimeframeDetails(timeframe);

  const toggleSort = (field: "name" | "status" | "rent") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const showOnly = (status: string, payment: string) => {
    setStatusFilter(status);
    setPaymentFilter(payment);
  };

  const sortHeader = (field: "name" | "status" | "rent", label: string) => (
    <button type="button" onClick={() => toggleSort(field)} className="flex cursor-pointer items-center gap-1 font-semibold">
      {label}
      <CaretUpDown size={14} aria-hidden className={sortBy === field ? "text-kumo-brand" : "text-kumo-subtle"} />
    </button>
  );

  const tenantBills = selectedTenant ? allInvoices.filter((i: any) => i.tenantId === selectedTenant.id) : [];
  const monthItems = Object.fromEntries(MONTH_NAMES.map((m, i) => [String(i), m]));
  const subDialogOpen = isBillModalOpen || isDocumentsModalOpen || !!tenantToDelete || !!cashPaymentInvoice || isEditModalOpen;

  const approveSlip = async (invoiceId: string) => {
    try {
      setToast({ msg: "Processing approval...", type: "success" });
      const res = await updateInvoiceStatus(invoiceId, "PAID");
      if (res.success) {
        setToast({ msg: "Payment Cleared!", type: "success" });
        loadTenants();
      } else {
        setToast({ msg: "Error: " + res.error, type: "error" });
      }
    } catch (e: any) {
      setToast({ msg: "Error: " + e.message, type: "error" });
    }
  };

  return (
    <>
      {toast && (
        <div
          role="status"
          className="fixed right-4 top-24 z-300 flex max-w-sm items-start gap-3 rounded-lg border border-kumo-line bg-kumo-base p-4 shadow-lg"
        >
          <p className={cn("text-sm font-medium", toast.type === "success" ? "text-kumo-success" : "text-kumo-danger")}>
            {toast.msg}
          </p>
          <Button size="sm" variant="ghost" onClick={() => setToast(null)}>
            Close
          </Button>
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
            "z-250",
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
              "backdrop-blur-xs",
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
              "rounded-2xl",
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
                  <h2 className="text-xl font-semibold tracking-tight">
                    Edit Tenant
                  </h2>
                  <p className="text-xs text-white/70 font-bold">
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

            <div className="p-5 sm:p-8 space-y-5">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-2">
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
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-xl text-sm font-bold focus:border-primary focus:outline-hidden transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-2">
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
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-xl text-sm font-bold focus:border-primary focus:outline-hidden transition-all"
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
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-2">
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
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-xl text-sm font-bold focus:border-primary focus:outline-hidden transition-all"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PENDING">PENDING</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                    <option value="PAST">PAST</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-2">
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
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-xl text-sm font-semibold text-emerald-500 focus:border-primary focus:outline-hidden transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-2">
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
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-xl text-sm font-medium focus:border-primary focus:outline-hidden transition-all resize-none"
                  placeholder="e.g. Luxury Footwear Provider"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-3.5 bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-slate-400 font-bold text-xs rounded-xl hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="flex-2 py-3.5 bg-primary text-white font-semibold text-xs rounded-xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {saving ? (
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

      {/* Record Cash Payment Modal */}
      {cashPaymentInvoice && (
        <RecordCashPaymentModal
          invoice={cashPaymentInvoice}
          tenantName={selectedTenant?.shopName}
          onClose={() => setCashPaymentInvoice(null)}
          onRecorded={() => {
            setCashPaymentInvoice(null);
            setToast({ msg: "Payment recorded!", type: "success" });
            loadTenants();
          }}
        />
      )}

      <AdminPage
        title="Tenant Monitoring"
        description="Monitor tenant performance, store occupancy, lease payments, and store operations."
        actions={
          <>
            <RecordPaymentGuide
              onShowTenants={(onlyVerifying) => {
                setSearchQuery("");
                setStatusFilter("all");
                setPaymentFilter(onlyVerifying ? VERIFYING : "all");
              }}
            />
            <Button variant="secondary" icon={<DownloadSimple />} loading={isExporting} onClick={() => setIsReportOpen(true)}>
              Download Report
            </Button>
            <Button variant="primary" icon={<UserPlus />} onClick={() => setIsRegisterOpen(true)}>
              Add Account
            </Button>
          </>
        }
      >
        <PaymentLedgerDialog open={ledgerOpen} onOpenChange={setLedgerOpen} adminId={adminUser?.id} />

        <StatRow>
          <Stat label="Total tenants" value={stats.total} onClick={() => showOnly("all", "all")} />
          <Stat label="Active" value={stats.active} onClick={() => showOnly("ACTIVE", "all")} active={statusFilter === "ACTIVE"} />
          <Stat
            label="Waiting for approval"
            value={stats.pending}
            tone={stats.pending ? "warning" : "default"}
            onClick={() => showOnly("PENDING", "all")}
            active={statusFilter === "PENDING"}
          />
          <Stat
            label="Overdue"
            value={stats.overdue}
            tone={stats.overdue ? "danger" : "default"}
            onClick={() => showOnly("all", OVERDUE)}
            active={paymentFilter === OVERDUE}
          />
          <Stat
            label={`Estimated revenue, ${tfDetails.periodBadge.toLowerCase()}`}
            value={money(Math.round((stats.totalRevenue || 0) * multiplier))}
            hint="View payments"
            onClick={() => setLedgerOpen(true)}
          />
          <Stat
            label={`Collected, ${tfDetails.periodBadge.toLowerCase()}`}
            value={money(stats.collectedRevenue * multiplier)}
            hint={`Pending ${money(stats.pendingRevenue * multiplier)}`}
            tone="success"
          />
          <Stat label="Paid tenants" value={stats.paidTenants} hint="Settled accounts" />
        </StatRow>

        <Panel flush>
          <div className="space-y-3 border-b border-kumo-line p-4 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <SearchField
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search shop name, unit or email"
                className="sm:w-80"
              />
              <Choice label="Status" value={statusFilter} items={STATUS_FILTERS} onChange={setStatusFilter} className="w-40" />
              <Choice label="Payment" value={paymentFilter} items={PAYMENT_FILTERS} onChange={setPaymentFilter} className="w-44" />
              <Choice label="Period" value={timeframe} items={PERIODS} onChange={(v) => setTimeframe(v as Timeframe)} className="w-40" />
              <div role="group" aria-label="View mode" className="ml-auto hidden gap-1 lg:flex">
                <Button
                  variant={viewMode === "table" ? "primary" : "secondary"}
                  shape="square"
                  icon={<ListDashes />}
                  aria-label="Table view"
                  aria-pressed={viewMode === "table"}
                  onClick={() => setViewMode("table")}
                />
                <Button
                  variant={viewMode === "grid" ? "primary" : "secondary"}
                  shape="square"
                  icon={<SquaresFour />}
                  aria-label="Card view"
                  aria-pressed={viewMode === "grid"}
                  onClick={() => setViewMode("grid")}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-kumo-subtle">
                Showing {filteredTenants.length === 0 ? 0 : pageStart + 1} to{" "}
                {Math.min(pageStart + pageSize, filteredTenants.length)} of {filteredTenants.length} tenant
                {filteredTenants.length === 1 ? "" : "s"}
                {filteredTenants.length !== tenants.length && ` (${tenants.length} total)`}
              </p>
              {(searchQuery || statusFilter !== "all" || paymentFilter !== "all") && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSearchQuery("");
                    showOnly("all", "all");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-24">
              <Loader />
            </div>
          ) : filteredTenants.length === 0 ? (
            <EmptyNote title="No tenants match">Try a different search or filter.</EmptyNote>
          ) : (
            <>
              {viewMode === "table" && (
                <div className="hidden overflow-x-auto lg:block">
                  <Table>
                    <Table.Header>
                      <Table.Row>
                        <Table.Head>{sortHeader("name", "Tenant")}</Table.Head>
                        <Table.Head>Unit</Table.Head>
                        <Table.Head>{sortHeader("status", "Status")}</Table.Head>
                        <Table.Head>Payment</Table.Head>
                        <Table.Head>{sortHeader("rent", tfDetails.rentColumnTitle)}</Table.Head>
                        <Table.Head className="text-right">Actions</Table.Head>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {paginatedTenants.map((tenant) => {
                        const pay = paymentOf(tenant.paymentStatus);
                        const rating = tenant.metrics?.rating || 0;
                        return (
                          <Table.Row key={tenant.id} className="cursor-pointer" onClick={() => setSelectedTenant(tenant)}>
                            <Table.Cell className="max-w-72">
                              <Person
                                square
                                name={tenant.shopName}
                                image={tenant.logoUrl}
                                detail={`${tenant.user?.email ?? ""}${rating > 0 ? `, ${rating.toFixed(1)} stars` : ""}`}
                              />
                            </Table.Cell>
                            <Table.Cell className="whitespace-nowrap text-sm text-kumo-default">{unitsText(tenant)}</Table.Cell>
                            <Table.Cell>
                              <TenantStatus status={tenant.status} />
                            </Table.Cell>
                            <Table.Cell className="whitespace-nowrap">
                              <p className={cn("text-sm font-medium", pay.className)}>{pay.label}</p>
                              {tenant.nextDueDate !== "N/A" && <p className="text-sm text-kumo-subtle">Due {tenant.nextDueDate}</p>}
                            </Table.Cell>
                            <Table.Cell className="whitespace-nowrap">
                              <p className="text-sm font-medium tabular-nums text-kumo-default">
                                {rentText(tenant, multiplier)}
                              </p>
                              {tenant.rentSource === "listed" && <p className="text-sm text-kumo-subtle">Listed rent, no lease</p>}
                              {timeframe !== "monthly" && tenant.rentSource !== "none" && (
                                <p className="text-sm text-kumo-subtle">Base {money(tenant.rentCost || 0)} a month</p>
                              )}
                            </Table.Cell>
                            <Table.Cell className="text-right">
                              <Button
                                size="sm"
                                variant={tenant.hasSlipToVerify || tenant.status === "PENDING" ? "primary" : "secondary"}
                                aria-label={`Open ${tenant.shopName}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTenant(tenant);
                                }}
                              >
                                {tenant.hasSlipToVerify ? "Check slip" : tenant.status === "PENDING" ? "Review" : "Open"}
                              </Button>
                            </Table.Cell>
                          </Table.Row>
                        );
                      })}
                    </Table.Body>
                  </Table>
                </div>
              )}

              {/* Cards: the chosen view, and always below the lg breakpoint. */}
              <ul
                className={cn(
                  "grid gap-3 p-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-3 xl:grid-cols-4",
                  viewMode === "table" && "lg:hidden",
                )}
              >
                {paginatedTenants.map((tenant) => {
                  const pay = paymentOf(tenant.paymentStatus);
                  return (
                    <li key={tenant.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedTenant(tenant)}
                        className="block h-full w-full cursor-pointer space-y-3 rounded-lg border border-kumo-line p-4 text-left hover:bg-kumo-tint"
                      >
                        <Person square name={tenant.shopName} image={tenant.logoUrl} detail={unitsText(tenant)} />
                        <span className="flex items-center justify-between gap-2">
                          <TenantStatus status={tenant.status} />
                          <span className={cn("text-sm font-medium", pay.className)}>{pay.label}</span>
                        </span>
                        <span className="flex items-center justify-between gap-2 text-sm">
                          <span className="font-medium tabular-nums text-kumo-default">
                            {rentText(tenant, multiplier)}
                            {tenant.rentSource !== "none" && (
                              <span className="font-normal text-kumo-subtle">{tfDetails.unitSuffix}</span>
                            )}
                          </span>
                          <span className="text-kumo-subtle">{(tenant.metrics?.rating || 0).toFixed(1)} stars</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-kumo-line p-4 sm:px-5">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-kumo-subtle">Rows</span>
                  <Choice
                    label="Tenants per page"
                    value={String(pageSize)}
                    items={PAGE_SIZES}
                    onChange={(v) => setPageSize(Number(v))}
                    className="w-20"
                  />
                </div>
                <nav aria-label="Pages" className="flex flex-wrap items-center gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    shape="square"
                    icon={<CaretLeft />}
                    aria-label="Previous page"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(Math.max(1, currentPage - 1))}
                  />
                  {pageNumbers.map((entry, index) =>
                    entry === "ellipsis" ? (
                      <span key={`ellipsis-${index}`} className="px-1 text-sm text-kumo-subtle">
                        …
                      </span>
                    ) : (
                      <Button
                        key={entry}
                        size="sm"
                        variant={entry === currentPage ? "primary" : "secondary"}
                        aria-label={`Page ${entry}`}
                        aria-current={entry === currentPage ? "page" : undefined}
                        onClick={() => setPage(entry)}
                      >
                        {entry}
                      </Button>
                    ),
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    shape="square"
                    icon={<CaretRight />}
                    aria-label="Next page"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                  />
                </nav>
                <p className="text-sm text-kumo-subtle">
                  Page {currentPage} of {totalPages}
                </p>
              </div>
            </>
          )}
        </Panel>
      </AdminPage>

      {/* Report downloads */}
      <AdminDialog
        open={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        title="Download tenant reports"
        description="Choose a month, a year, or all records. Each downloads as a PDF."
      >
        <div className="space-y-5">
          <section className="space-y-3 rounded-lg border border-kumo-line p-4">
            <h3 className="text-sm font-semibold text-kumo-default">Monthly report</h3>
            <div className="grid grid-cols-2 gap-2">
              <Choice label="Month" value={String(reportMonth)} items={monthItems} onChange={(v) => setReportMonth(Number(v))} className="w-full" />
              <Choice label="Year" value={String(reportYear)} items={YEARS} onChange={(v) => setReportYear(Number(v))} className="w-full" />
            </div>
            <Button variant="primary" icon={<DownloadSimple />} loading={isExporting} onClick={handleExportMonthlyReport}>
              Download {MONTH_NAMES[reportMonth]} {reportYear}
            </Button>
          </section>
          <section className="space-y-3 rounded-lg border border-kumo-line p-4">
            <h3 className="text-sm font-semibold text-kumo-default">Yearly report</h3>
            <Choice
              label="Report year"
              value={String(reportYearFilter)}
              items={YEARS}
              onChange={(v) => setReportYearFilter(Number(v))}
              className="w-full"
            />
            <Button variant="primary" icon={<DownloadSimple />} loading={isExporting} onClick={handleExportYearlyReport}>
              Download {reportYearFilter}
            </Button>
          </section>
          <Button variant="secondary" icon={<FileText />} disabled={isExporting} onClick={handleExportReport}>
            Download all-time report
          </Button>
        </div>
      </AdminDialog>

      {/* One tenant: hidden while a bill, document, payment or delete window is open above it. */}
      <AdminDialog
        open={!!selectedTenant && !subDialogOpen}
        onClose={() => setSelectedTenant(null)}
        size="lg"
        title={selectedTenant?.shopName ?? ""}
        description={selectedTenant ? unitsText(selectedTenant) : undefined}
      >
        {selectedTenant && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Person
                square
                name={selectedTenant.user?.name || selectedTenant.user?.email || "No owner on file"}
                detail={selectedTenant.user?.email}
                image={selectedTenant.logoUrl}
              />
              <TenantStatus status={selectedTenant.status} />
            </div>
            {selectedTenant.description && <p className="text-sm text-kumo-subtle">{selectedTenant.description}</p>}

            <div className="flex flex-wrap gap-2">
              <Button variant="primary" icon={<Receipt />} onClick={handlePostMonthlyBill}>
                Post Monthly Bill
              </Button>
              <Button variant="secondary" icon={<ChatCircle />} onClick={handleSendMessage}>
                Message
              </Button>
              <Button variant="secondary" icon={<FileText />} onClick={handleViewDocuments}>
                Documents
              </Button>
              <Button variant="secondary-destructive" icon={<Trash />} className="ml-auto" onClick={() => setTenantToDelete(selectedTenant)}>
                Delete
              </Button>
            </div>

            {selectedTenant.status === "PENDING" && (
              <section className="space-y-3 rounded-lg border border-kumo-line bg-kumo-recessed p-4">
                <div>
                  <h3 className="text-sm font-semibold text-kumo-default">Approve Application</h3>
                  <p className="text-sm text-kumo-subtle">
                    Assign a unit to approve this merchant. This changes their account role to Tenant.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Choice
                    label="Unit to assign"
                    value={selectedUnitForApproval || "none"}
                    items={{
                      none: "Select a unit",
                      ...Object.fromEntries(availableSlots.map((slot) => [slot.unit_id, `${slot.unit_id}, ${slot.sqm_size} sqm`])),
                    }}
                    onChange={(v) => setSelectedUnitForApproval(v === "none" ? "" : v)}
                    className="w-60"
                  />
                  <Button
                    variant="primary"
                    loading={isApproving === selectedTenant.id}
                    disabled={!selectedUnitForApproval}
                    onClick={() => handleApproveTenant(selectedTenant.id)}
                  >
                    Approve &amp; Assign Unit
                  </Button>
                </div>
              </section>
            )}

            <PageTabs
              value={detailTab}
              onValueChange={(v) => setTabChoice({ id: selectedTenant.id, tab: v as "details" | "payments" })}
              tabs={[
                { value: "details", label: "Details" },
                { value: "payments", label: selectedTenant.hasSlipToVerify ? "Payments (slip to check)" : "Payments" },
              ]}
            />

            {detailTab === "details" ? (
              <div className="space-y-3">
                <LeaseList tenant={selectedTenant} />
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Fact label={tfDetails.rentColumnTitle}>{rentText(selectedTenant, multiplier)}</Fact>
                  <Fact label="Rating">{(selectedTenant.metrics?.rating || 0).toFixed(1)} out of 5</Fact>
                  <Fact label="Reviews">{selectedTenant.metrics?.inquiries || 0}</Fact>
                  {!!selectedTenant.violations && <Fact label="Violations">{selectedTenant.violations}</Fact>}
                </dl>
              </div>
            ) : (
              <div className="space-y-3">
                <dl className="grid grid-cols-2 gap-3">
                  <Fact label="Total paid">{money(sumOf(tenantBills, true))}</Fact>
                  <Fact label="Outstanding">{money(sumOf(tenantBills, false))}</Fact>
                </dl>
                {tenantBills.length === 0 ? (
                  <p className="rounded-lg border border-kumo-line p-4 text-center text-sm text-kumo-subtle">No bills yet.</p>
                ) : (
                  <ul className="divide-y divide-kumo-line rounded-lg border border-kumo-line">
                    {tenantBills.map((inv: any) => (
                      <li key={inv.id} className="space-y-2 p-3">
                        <BillLine invoice={inv} />
                        <div className="flex flex-wrap justify-end gap-2">
                          {inv.status === "REVIEWING" && inv.depositSlipUrl && (
                            <>
                              <SlipLink url={inv.depositSlipUrl} />
                              <Button size="sm" variant="primary" onClick={() => approveSlip(inv.id)}>
                                Approve
                              </Button>
                            </>
                          )}
                          {(inv.status === "PENDING" || inv.status === "OVERDUE") && (
                            <Button size="sm" variant="primary" onClick={() => openCashPaymentModal(inv)}>
                              Record Cash Payment
                            </Button>
                          )}
                        </div>
                        {inv.status === "PAID" && inv.referenceNo && (
                          <p className="text-xs text-kumo-subtle">Reference {inv.referenceNo}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </AdminDialog>

      {/* Post a bill */}
      <AdminDialog
        open={isBillModalOpen && !!selectedTenant}
        onClose={() => setIsBillModalOpen(false)}
        title="Post Monthly Bill"
        description={selectedTenant?.shopName}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsBillModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={handleSubmitBill}>
              Post Bill
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Amount to bill (PHP)"
            description={
              !selectedTenant?.rentCost
                ? "No rent is saved for this tenant. Type the amount."
                : selectedTenant.units.length > 1
                  ? `Recorded against Unit ${selectedTenant.units[0]}, filled in with that unit's rent.`
                  : undefined
            }
            type="number"
            value={billFormData.amount}
            onChange={(e) => setBillFormData({ ...billFormData, amount: Number(e.target.value) })}
            className="w-full"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Billing month"
              placeholder="e.g. Nov 2026"
              value={billFormData.month}
              onChange={(e) => setBillFormData({ ...billFormData, month: e.target.value })}
            />
            <Input
              label="Due date"
              type="date"
              value={billFormData.dueDate}
              onChange={(e) => setBillFormData({ ...billFormData, dueDate: e.target.value })}
            />
          </div>
          <InputArea
            label="Description"
            rows={2}
            value={billFormData.description}
            onValueChange={(v) => setBillFormData({ ...billFormData, description: v })}
            className="w-full"
          />
        </div>
      </AdminDialog>

      {/* Documents and receipts */}
      <AdminDialog
        open={isDocumentsModalOpen && !!selectedTenant}
        onClose={() => setIsDocumentsModalOpen(false)}
        size="lg"
        title="Tenant documents and records"
        description={selectedTenant ? `${selectedTenant.shopName}, ${unitsText(selectedTenant)}` : undefined}
        footer={
          <Button variant="secondary" onClick={() => setIsDocumentsModalOpen(false)}>
            Close
          </Button>
        }
      >
        {selectedTenant && (
          <div className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-kumo-default">Lease agreement and voucher</h3>
              <LeaseList
                tenant={selectedTenant}
                action={(lease) => (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<DownloadSimple />}
                    loading={generatingDoc === `voucher-${lease.unitId}`}
                    onClick={() => handleDownloadVoucher(selectedTenant, lease)}
                  >
                    Download Lease PDF
                  </Button>
                )}
              />
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-kumo-default">
                Receipts and invoices ({tenantBills.length})
              </h3>
              {tenantBills.length === 0 ? (
                <p className="rounded-lg border border-kumo-line p-4 text-center text-sm text-kumo-subtle">
                  Posted invoices and official payments will be listed here.
                </p>
              ) : (
                <ul className="max-h-72 divide-y divide-kumo-line overflow-y-auto rounded-lg border border-kumo-line">
                  {tenantBills.map((inv: any) => (
                    <li key={inv.id} className="space-y-2 p-3">
                      <BillLine invoice={inv} />
                      {(inv.depositSlipUrl || inv.status === "PAID") && (
                        <div className="flex flex-wrap justify-end gap-2">
                          {inv.depositSlipUrl && <SlipLink url={inv.depositSlipUrl} />}
                          {inv.status === "PAID" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={<DownloadSimple />}
                              loading={generatingDoc === `receipt-${inv.id}`}
                              onClick={() => handleDownloadReceipt(inv, selectedTenant)}
                            >
                              Official Receipt
                            </Button>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-kumo-line p-4">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-kumo-default">Tenant report</h3>
                <p className="text-sm text-kumo-subtle">Space, rent, balance and ratings in one PDF.</p>
              </div>
              <Button
                variant="secondary"
                icon={<DownloadSimple />}
                loading={generatingDoc === "summary"}
                onClick={() => handleDownloadTenantSummary(selectedTenant)}
              >
                Export Report
              </Button>
            </section>
          </div>
        )}
      </AdminDialog>

      {/* Delete confirmation */}
      <AdminDialog
        open={!!tenantToDelete}
        onClose={() => !isDeletingTenant && setTenantToDelete(null)}
        size="sm"
        title="Delete Tenant"
        description="This can't be undone."
        footer={
          <>
            <Button variant="secondary" disabled={isDeletingTenant} onClick={() => setTenantToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" loading={isDeletingTenant} onClick={handleConfirmDelete}>
              Confirm Delete
            </Button>
          </>
        }
      >
        {tenantToDelete && (
          <div className="space-y-3 text-sm text-kumo-default">
            <p>
              Are you sure you want to delete <strong>{tenantToDelete.shopName}</strong>?
            </p>
            <ul className="list-disc space-y-1 pl-5 text-kumo-subtle">
              <li>The tenant profile and its invoices are permanently deleted.</li>
              <li>A summary (unit, lease dates, payments) is kept in User Management, Tenant History.</li>
              <li>{unitsText(tenantToDelete)} is released and becomes available.</li>
              <li>The merchant account goes back to a customer account.</li>
            </ul>
          </div>
        )}
      </AdminDialog>
    </>
  );
}

const money = (n: number) =>
  `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const unitsText = (t: { units: string[] }) => {
  const units = t.units.filter((u) => u !== UNASSIGNED_UNIT && u !== "PENDING");
  return units.length ? `Unit ${units.join(", ")}` : "No unit yet";
};

/** Rent for the chosen period, or "Not set" when none is recorded. */
const rentText = (t: { rentCost?: number; rentSource: string }, multiplier: number) =>
  t.rentSource === "none" ? "Not set" : money(Math.round((t.rentCost || 0) * multiplier));

/** One row per leased unit: its rent and real dates. */
function LeaseList({ tenant, action }: { tenant: Tenant; action?: (lease: RentLease) => React.ReactNode }) {
  if (!tenant.leases.length) {
    return (
      <p className="rounded-lg border border-kumo-line p-4 text-sm text-kumo-subtle">
        No lease on record, so there are no lease dates.
        {tenant.rentSource === "listed" ? ` The unit's listed rent is ${money(tenant.rentCost || 0)} a month.` : ""}
      </p>
    );
  }
  return (
    <ul className="divide-y divide-kumo-line rounded-lg border border-kumo-line">
      {tenant.leases.map((lease) => (
        <li key={lease.unitId} className="flex flex-wrap items-center justify-between gap-3 p-3">
          <div>
            <p className="text-sm font-semibold text-kumo-default">
              Unit {lease.unitId}, {money(lease.monthlyRent)} a month
            </p>
            <p className="text-sm text-kumo-subtle">
              Started {formatPHDate(lease.startDate)}, paid through {formatPHDate(lease.endDate)}
            </p>
          </div>
          {action?.(lease)}
        </li>
      ))}
    </ul>
  );
}

const sumOf = (bills: any[], paid: boolean) =>
  bills.filter((i) => (i.status === "PAID") === paid).reduce((sum, i) => sum + i.amount, 0);

/** A labelled Kumo dropdown. `items` maps each value to the text shown. */
function Choice({
  label,
  value,
  items,
  onChange,
  className,
}: {
  label: string;
  value: string;
  items: Record<string, string>;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <Select
      aria-label={label}
      value={value}
      items={items}
      onValueChange={(v) => v != null && onChange(v as string)}
      className={className}
    >
      {Object.entries(items).map(([key, text]) => (
        <Select.Option key={key} value={key}>
          {text}
        </Select.Option>
      ))}
    </Select>
  );
}

function TenantStatus({ status }: { status: string }) {
  const s = STATUS_TEXT[status] ?? STATUS_TEXT.INACTIVE;
  return <span className={cn("whitespace-nowrap text-sm font-medium", s.className)}>{s.label}</span>;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-kumo-line p-3">
      <dt className="text-xs text-kumo-subtle">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-kumo-default">{children === 0 ? 0 : children || "-"}</dd>
    </div>
  );
}

function BillLine({ invoice: inv }: { invoice: any }) {
  const status = inv.status === "REVIEWING" ? "Checking slip" : inv.status.charAt(0) + inv.status.slice(1).toLowerCase();
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-kumo-default">{inv.invoiceNumber}</p>
        <p className="text-sm text-kumo-subtle">
          {inv.month}, due {new Date(inv.dueDate).toLocaleDateString()}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums text-kumo-default">{money(inv.amount)}</p>
        <p
          className={cn(
            "text-sm font-medium",
            inv.status === "PAID" ? "text-kumo-success" : inv.status === "OVERDUE" ? "text-kumo-danger" : "text-kumo-warning",
          )}
        >
          {status}
        </p>
      </div>
    </div>
  );
}

function SlipLink({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="self-center text-sm font-medium text-kumo-link hover:underline">
      View deposit slip
    </a>
  );
}
