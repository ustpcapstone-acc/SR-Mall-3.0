"use server";

import { prisma } from "@srmall/database";
import { revalidatePath } from "next/cache";
import { getBaseUrl } from "@/utils/get-base-url";

export async function getTenantInvoices(tenantId: string) {
  try {
    const invoices = await (prisma as any).invoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
    return invoices;
  } catch (error: any) {
    console.error("Failed to fetch tenant invoices:", error);
    return [];
  }
}

export async function submitDepositSlip(
  invoiceId: string,
  url: string,
  storageKey?: string,
) {
  try {
    const invoice = await (prisma as any).invoice.update({
      where: { id: invoiceId },
      data: {
        depositSlipUrl: url,
        storageKey: storageKey || null,
        status: "REVIEWING",
      },
    });
    revalidatePath("/tenantdashboard/lease-payments");
    revalidatePath("/admindashboard/finance");
    return { success: true, invoice };
  } catch (error: any) {
    console.error("Failed to submit deposit slip:", error);
    return { success: false, error: error.message };
  }
}

export async function getAllInvoices() {
  try {
    const invoices = await (prisma as any).invoice.findMany({
      include: {
        tenant: {
          select: {
            shopName: true,
            unitId: true,
            user: { select: { email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return invoices;
  } catch (error: any) {
    console.error("Failed to fetch all invoices:", error);
    return [];
  }
}

export async function updateInvoiceStatus(invoiceId: string, status: string) {
  try {
    const invoice = await (prisma as any).invoice.update({
      where: { id: invoiceId },
      data: { status },
    });
    revalidatePath("/tenantdashboard/lease-payments");
    revalidatePath("/admindashboard/finance");
    return { success: true, invoice };
  } catch (error: any) {
    console.error("Failed to update invoice status:", error);
    return { success: false, error: error.message };
  }
}

export async function recordManualPaymentAction(
  invoiceId: string,
  referenceNo: string,
) {
  try {
    const invoice = await (prisma as any).invoice.update({
      where: { id: invoiceId },
      data: {
        status: "PAID",
        referenceNo: referenceNo,
      },
      include: {
        tenant: {
          include: {
            user: true,
          },
        },
      },
    });

    // Notify Tenant of Payment Confirmation
    if (invoice?.tenant?.user?.email) {
      const appUrl = await getBaseUrl();
      fetch(`${appUrl}/api/notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "PAYMENT_CONFIRMED",
          email: invoice.tenant.user.email,
          data: {
            unitId: invoice.tenant.unitId,
            shopName: invoice.tenant.shopName,
            referenceNo: referenceNo,
          },
        }),
      }).catch((err: any) =>
        console.error("Failed to dispatch payment confirmation email:", err),
      );
    }

    revalidatePath("/tenantdashboard/lease-payments");
    revalidatePath("/admindashboard/tenant-monitoring");
    return { success: true, invoice };
  } catch (error: any) {
    console.error("Failed to record manual payment:", error);
    return { success: false, error: error.message };
  }
}

export async function generateInvoice(data: {
  tenantId: string;
  month: string;
  amount: number;
  dueDate: Date;
  description?: string;
}) {
  try {
    const invoiceNumber = `#INV-${Date.now().toString().slice(-6)}`;
    const invoice = await (prisma as any).invoice.create({
      data: {
        invoiceNumber,
        tenantId: data.tenantId,
        month: data.month,
        amount: data.amount,
        dueDate: data.dueDate,
        description: data.description,
        status: "PENDING",
      },
      include: {
        tenant: {
          include: {
            user: true,
          },
        },
      },
    });

    // Notify Tenant of Bill Posted
    if (invoice?.tenant?.user?.email) {
      const appUrl = await getBaseUrl();
      fetch(`${appUrl}/api/notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "BILL_POSTED",
          email: invoice.tenant.user.email,
          data: {
            unitId: invoice.tenant.unitId,
            shopName: invoice.tenant.shopName,
            amount: data.amount,
            month: data.month,
          },
        }),
      }).catch((err: any) =>
        console.error("Failed to dispatch bill posted email:", err),
      );
    }

    revalidatePath("/tenantdashboard/lease-payments");
    revalidatePath("/admindashboard/finance");
    return { success: true, invoice };
  } catch (error: any) {
    console.error("Failed to create invoice:", error);
    return { success: false, error: error.message };
  }
}

export async function getTenantPaymentScheduleAction(userId: string) {
  try {
    const tenant = await (prisma as any).tenant.findUnique({
      where: { userId },
      include: {
        invoices: {
          orderBy: { dueDate: "asc" },
        },
      },
    });

    if (!tenant) {
      return { success: false, error: "Tenant record not found" };
    }

    const slot = tenant.unitId
      ? await (prisma as any).areaSlot.findFirst({
          where: { unit_id: tenant.unitId },
        })
      : null;

    const baseRent = slot?.base_rent || 0;
    const invoices = tenant.invoices || [];

    // Separate paid invoices and unpaid invoices
    const paidInvoices = invoices
      .filter((inv: any) => inv.status === "PAID")
      .sort(
        (a: any, b: any) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime(),
      );

    const lastPaidInvoice = paidInvoices[0] || null;
    const lastPaymentDate = lastPaidInvoice
      ? lastPaidInvoice.updatedAt || lastPaidInvoice.createdAt
      : null;

    // Unpaid invoices sorted by dueDate ascending (earliest due first)
    const unpaidInvoices = invoices
      .filter((inv: any) => inv.status !== "PAID")
      .sort(
        (a: any, b: any) =>
          new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      );

    let nextPaymentDate: Date | string;
    let paymentMonth: string;
    let paymentAmount: number;
    let paymentStatus: "Paid" | "Pending" | "Overdue" | "Reviewing";
    let invoiceNumber: string | null = null;

    const now = new Date();

    if (unpaidInvoices.length > 0) {
      const nextInv = unpaidInvoices[0];
      nextPaymentDate = nextInv.dueDate;
      paymentMonth = nextInv.month;
      paymentAmount = nextInv.amount;
      invoiceNumber = nextInv.invoiceNumber;

      const isPastDue = new Date(nextInv.dueDate).getTime() < now.getTime();
      if (
        nextInv.status === "OVERDUE" ||
        (nextInv.status === "PENDING" && isPastDue)
      ) {
        paymentStatus = "Overdue";
      } else if (nextInv.status === "REVIEWING") {
        paymentStatus = "Reviewing";
      } else {
        paymentStatus = "Pending";
      }
    } else if (paidInvoices.length > 0) {
      paymentStatus = "Paid";
      paymentAmount = lastPaidInvoice.amount || baseRent;

      const lastDue = new Date(lastPaidInvoice.dueDate);
      const nextDue = new Date(lastDue);
      nextDue.setMonth(nextDue.getMonth() + 1);

      if (nextDue.getTime() < now.getTime()) {
        const nextMonthDate = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          5,
        );
        nextPaymentDate = nextMonthDate;
        paymentMonth = nextMonthDate.toLocaleString("en-US", {
          month: "long",
          year: "numeric",
        });
      } else {
        nextPaymentDate = nextDue;
        paymentMonth = nextDue.toLocaleString("en-US", {
          month: "long",
          year: "numeric",
        });
      }
    } else {
      const defaultDue = new Date(now.getFullYear(), now.getMonth(), 5);
      if (defaultDue.getTime() < now.getTime()) {
        defaultDue.setMonth(defaultDue.getMonth() + 1);
      }
      nextPaymentDate = defaultDue;
      paymentMonth = defaultDue.toLocaleString("en-US", {
        month: "long",
        year: "numeric",
      });
      paymentAmount = baseRent;
      paymentStatus = "Pending";
    }

    const totalUnpaidBalance = unpaidInvoices.reduce(
      (sum: number, inv: any) => sum + inv.amount,
      0,
    );

    return {
      success: true,
      data: {
        nextPaymentDate,
        paymentMonth,
        paymentAmount,
        paymentStatus,
        lastPaymentDate,
        invoiceNumber,
        totalUnpaidBalance,
        totalInvoices: invoices.length,
        paidInvoicesCount: paidInvoices.length,
        unitId: tenant.unitId,
        baseRent,
      },
    };
  } catch (error: any) {
    console.error("Failed to fetch tenant payment schedule:", error);
    return { success: false, error: error.message };
  }
}

