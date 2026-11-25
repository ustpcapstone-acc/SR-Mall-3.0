"use server";

/**
 * Leasing: tenants request spaces, staff approve them after the tenant pays on
 * site (which creates the lease and a paid e-invoice), staff record renewals,
 * and both sides read e-invoices. Every action checks the signed-in account.
 */
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@srmall/database";
import { AccessDenied, currentAccount, requireStaff } from "@/lib/auth-server";
import { notify } from "@/lib/notify";
import { phDayStart, formatPHDate } from "@/lib/ph-date";
import { TENANT_DOCUMENTS, type TenantDocument } from "@/lib/tenant-onboarding";
import {
  MAX_MONTHS,
  PAYMENT_METHODS,
  TERM_CHOICES,
  addMonths,
  cleanSettings,
  graceEndDate,
  invoiceStatus,
  peso,
  renewalStage,
  type EInvoiceStatus,
  type InvoiceLine,
  type LeaseSettingsData,
  type RenewalStage,
} from "@/lib/leasing";
import {
  createPaidInvoice,
  endLease,
  getLeaseSettings,
  reconcileLeases,
  sendInvoiceNotice,
  syncTenantUnit,
} from "@/lib/leasing-server";
import { requireTenantOwner } from "@/lib/workspace-server";

type Fail = { success: false; error: string };
const fail = (error: string): Fail => ({ success: false, error });

function errorOf(e: unknown, fallback: string): Fail {
  if (e instanceof AccessDenied || e instanceof UserError) return fail(e.message);
  console.error("[LEASING]", e);
  return fail(fallback);
}

class UserError extends Error {}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Renting spaces is for the store owner, not their staff. */
const myTenant = requireTenantOwner;

// ---------------------------------------------------------------------------
// Tenant side
// ---------------------------------------------------------------------------

export type AvailableSpace = {
  unitId: string;
  floor: string;
  category: string;
  sqm: number;
  monthlyRent: number;
  image: string | null;
  features: string[];
};

export type MyRequest = {
  id: string;
  unitId: string;
  months: number;
  note: string | null;
  status: string;
  adminComment: string | null;
  createdAt: string;
  decidedAt: string | null;
};

export type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  unitId: string | null;
  month: string;
  amount: number;
  status: EInvoiceStatus;
  issuedAt: string;
  paidAt: string | null;
};

export type MyLease = {
  id: string;
  unitId: string;
  floor: string | null;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  status: string;
  stage: RenewalStage | null;
  graceEnds: string;
  endReason: string | null;
  endedAt: string | null;
};

function toInvoiceRow(i: {
  id: string;
  invoiceNumber: string;
  unitId: string | null;
  month: string;
  amount: number;
  status: string;
  dueDate: Date;
  createdAt: Date;
  paidAt: Date | null;
}): InvoiceRow {
  return {
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    unitId: i.unitId,
    month: i.month,
    amount: Number(i.amount) || 0,
    status: invoiceStatus(i.status, i.dueDate),
    issuedAt: i.createdAt.toISOString(),
    paidAt: i.paidAt?.toISOString() ?? null,
  };
}

const INVOICE_SELECT = {
  id: true,
  invoiceNumber: true,
  unitId: true,
  month: true,
  amount: true,
  status: true,
  dueDate: true,
  createdAt: true,
  paidAt: true,
} as const;

/** Everything the tenant's Rent a Space page shows. */
export async function getRentASpaceAction() {
  try {
    const tenant = await myTenant();
    const settings = await getLeaseSettings();
    const [slots, requests, leases, invoices, shop] = await Promise.all([
      prisma.areaSlot.findMany({
        where: { status: "AVAILABLE" },
        orderBy: [{ floor: "asc" }, { unit_id: "asc" }],
        select: { unit_id: true, floor: true, category: true, sqm_size: true, base_rent: true, space_images: true, features: true },
      }),
      prisma.rentRequest.findMany({ where: { tenantId: tenant.id }, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.lease.findMany({ where: { tenantId: tenant.id }, orderBy: [{ status: "asc" }, { startDate: "desc" }] }),
      prisma.invoice.findMany({
        where: { tenantId: tenant.id, leaseId: { not: null } },
        orderBy: { createdAt: "desc" },
        select: INVOICE_SELECT,
      }),
      prisma.tenant.findUnique({ where: { id: tenant.id }, select: { logoUrl: true, description: true, products: true } }),
    ]);
    const floors = new Map(
      (
        await prisma.areaSlot.findMany({
          where: { unit_id: { in: leases.map((l) => l.unitId) } },
          select: { unit_id: true, floor: true },
        })
      ).map((s) => [s.unit_id, s.floor]),
    );

    return {
      success: true as const,
      data: {
        shopName: tenant.shopName,
        /** What the storefront still lacks (for the Home checklist). */
        storefront: {
          logo: !!shop?.logoUrl,
          description: !!shop?.description?.trim(),
          product: Array.isArray(shop?.products) && shop.products.length > 0,
        },
        settings,
        spaces: slots.map<AvailableSpace>((s) => ({
          unitId: s.unit_id,
          floor: s.floor,
          category: s.category,
          sqm: s.sqm_size,
          monthlyRent: s.base_rent,
          image: s.space_images[0] ?? null,
          features: s.features,
        })),
        requests: requests.map<MyRequest>((r) => ({
          id: r.id,
          unitId: r.unitId,
          months: r.months,
          note: r.note,
          status: r.status,
          adminComment: r.adminComment,
          createdAt: r.createdAt.toISOString(),
          decidedAt: r.decidedAt?.toISOString() ?? null,
        })),
        leases: leases.map<MyLease>((l) => ({
          id: l.id,
          unitId: l.unitId,
          floor: floors.get(l.unitId) ?? null,
          startDate: l.startDate.toISOString(),
          endDate: l.endDate.toISOString(),
          monthlyRent: l.monthlyRent,
          status: l.status,
          stage: l.status === "ACTIVE" ? renewalStage(l.endDate, settings) : null,
          graceEnds: graceEndDate(l.endDate, settings).toISOString(),
          endReason: l.endReason,
          endedAt: l.endedAt?.toISOString() ?? null,
        })),
        invoices: invoices.map(toInvoiceRow),
      },
    };
  } catch (e) {
    return errorOf(e, "Couldn't load spaces.");
  }
}

export async function createRentRequestAction(input: { unitId: string; months: number; note?: string }) {
  try {
    const tenant = await myTenant();
    const unitId = String(input?.unitId ?? "");
    const months = Number(input?.months);
    const note = String(input?.note ?? "").trim().slice(0, 1000) || null;
    if (!(TERM_CHOICES as readonly number[]).includes(months)) return fail("Choose a lease term.");

    const slot = await prisma.areaSlot.findUnique({ where: { unit_id: unitId }, select: { status: true } });
    if (!slot) return fail("This space no longer exists.");
    if (slot.status !== "AVAILABLE") return fail(`Unit ${unitId} is no longer available.`);

    const pending = await prisma.rentRequest.count({ where: { tenantId: tenant.id, status: "PENDING" } });
    if (pending >= 5) return fail("You have 5 open requests. Wait for a decision or cancel one first.");

    try {
      await prisma.rentRequest.create({ data: { tenantId: tenant.id, unitId, months, note } });
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002") return fail(`You already have an open request for Unit ${unitId}.`);
      throw e;
    }

    after(() =>
      notify("SPACE_RESERVATION", {
        roles: ["ADMIN"],
        title: `Rent request: Unit ${unitId}`,
        message: `${tenant.shopName} asked to rent Unit ${unitId} for ${months} month${months === 1 ? "" : "s"}. Approve it once they have paid at the office.`,
        link: "/admindashboard/rent-requests",
      }),
    );
    revalidatePath("/admindashboard/rent-requests");
    return { success: true as const };
  } catch (e) {
    return errorOf(e, "Couldn't send your request. Please try again.");
  }
}

export async function cancelRentRequestAction(id: string) {
  try {
    const tenant = await myTenant();
    const done = await prisma.rentRequest.updateMany({
      where: { id: String(id), tenantId: tenant.id, status: "PENDING" },
      data: { status: "CANCELLED", decidedAt: new Date() },
    });
    if (!done.count) return fail("This request was already decided.");
    revalidatePath("/admindashboard/rent-requests");
    return { success: true as const };
  } catch (e) {
    return errorOf(e, "Couldn't cancel the request.");
  }
}

// ---------------------------------------------------------------------------
// E-invoice (tenant: their own; staff with Leasing: any)
// ---------------------------------------------------------------------------

export type EInvoice = {
  invoiceNumber: string;
  status: EInvoiceStatus;
  issuedAt: string;
  paidAt: string | null;
  dueDate: string;
  periodStart: string | null;
  periodEnd: string | null;
  unitId: string | null;
  floor: string | null;
  lines: InvoiceLine[];
  total: number;
  paymentMethod: string | null;
  referenceNo: string | null;
  billedTo: { shopName: string; companyName: string | null; address: string | null; contact: string | null; email: string | null };
};

export async function getEInvoiceAction(invoiceId: string): Promise<{ success: true; data: EInvoice } | Fail> {
  try {
    const account = await currentAccount();
    if (!account) throw new AccessDenied("Please sign in again.");
    const inv = await prisma.invoice.findUnique({
      where: { id: String(invoiceId) },
      include: {
        tenant: {
          select: {
            userId: true,
            shopName: true,
            companyName: true,
            businessAddress: true,
            unitId: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
    });
    if (!inv) return fail("Invoice not found.");
    const isOwner = account.type === "TENANT" && inv.tenant.userId === account.id;
    // Tenant staff with Payments: invoices of their space (or older ones without a space).
    const ts = account.tenantStaff;
    const isStaff =
      !!ts && ts.permissions.includes("payments") && ts.tenantId === inv.tenantId && (!inv.leaseId || inv.leaseId === ts.leaseId);
    if (!isOwner && !isStaff) await requireStaff("leasing");

    const unitId = inv.unitId || inv.tenant.unitId || null;
    const slot = unitId ? await prisma.areaSlot.findUnique({ where: { unit_id: unitId }, select: { floor: true } }) : null;
    const stored = Array.isArray(inv.lineItems) ? (inv.lineItems as InvoiceLine[]) : [];
    const lines = stored.length
      ? stored
      : [{ description: inv.description || `Rent, ${inv.month}`, quantity: 1, unitPrice: inv.amount, amount: inv.amount }];

    return {
      success: true,
      data: {
        invoiceNumber: inv.invoiceNumber,
        status: invoiceStatus(inv.status, inv.dueDate),
        issuedAt: inv.createdAt.toISOString(),
        paidAt: inv.paidAt?.toISOString() ?? null,
        dueDate: inv.dueDate.toISOString(),
        periodStart: inv.periodStart?.toISOString() ?? null,
        periodEnd: inv.periodEnd?.toISOString() ?? null,
        unitId,
        floor: slot?.floor ?? null,
        lines,
        total: inv.amount,
        paymentMethod: inv.paymentMethod,
        referenceNo: inv.referenceNo,
        billedTo: {
          shopName: inv.tenant.shopName,
          companyName: inv.tenant.companyName,
          address: inv.tenant.businessAddress,
          contact: inv.tenant.user?.name ?? null,
          email: inv.tenant.user?.email ?? null,
        },
      },
    };
  } catch (e) {
    return errorOf(e, "Couldn't load the invoice.");
  }
}

// ---------------------------------------------------------------------------
// Staff: rent requests
// ---------------------------------------------------------------------------

export type RentRequestRow = MyRequest & {
  tenant: {
    id: string;
    shopName: string;
    companyName: string | null;
    category: string;
    phone: string | null;
    businessAddress: string | null;
    ownerName: string | null;
    ownerEmail: string;
    status: string;
    documents: { type: string; label: string; name: string }[];
    activeSpaces: string[];
  };
  space: { floor: string; category: string; sqm: number; monthlyRent: number; status: string } | null;
};

export async function listRentRequestsAction(): Promise<{ success: true; data: RentRequestRow[] } | Fail> {
  try {
    await requireStaff("leasing");
    const rows = await prisma.rentRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
      include: {
        tenant: {
          select: {
            id: true,
            shopName: true,
            companyName: true,
            category: true,
            phone: true,
            businessAddress: true,
            status: true,
            documents: true,
            user: { select: { name: true, email: true } },
            leases: { where: { status: "ACTIVE" }, select: { unitId: true } },
          },
        },
      },
    });
    const slots = new Map(
      (
        await prisma.areaSlot.findMany({
          where: { unit_id: { in: [...new Set(rows.map((r) => r.unitId))] } },
          select: { unit_id: true, floor: true, category: true, sqm_size: true, base_rent: true, status: true },
        })
      ).map((s) => [s.unit_id, s]),
    );
    const label = (type: string) => TENANT_DOCUMENTS.find((d) => d.type === type)?.label ?? type;

    const data = rows.map<RentRequestRow>((r) => {
      const s = slots.get(r.unitId);
      const docs = Array.isArray(r.tenant.documents) ? (r.tenant.documents as TenantDocument[]) : [];
      return {
        id: r.id,
        unitId: r.unitId,
        months: r.months,
        note: r.note,
        status: r.status,
        adminComment: r.adminComment,
        createdAt: r.createdAt.toISOString(),
        decidedAt: r.decidedAt?.toISOString() ?? null,
        tenant: {
          id: r.tenant.id,
          shopName: r.tenant.shopName,
          companyName: r.tenant.companyName,
          category: r.tenant.category,
          phone: r.tenant.phone,
          businessAddress: r.tenant.businessAddress,
          ownerName: r.tenant.user.name,
          ownerEmail: r.tenant.user.email,
          status: r.tenant.status,
          documents: docs.map((d) => ({ type: d.type, label: label(d.type), name: d.name })),
          activeSpaces: r.tenant.leases.map((l) => l.unitId),
        },
        space: s ? { floor: s.floor, category: s.category, sqm: s.sqm_size, monthlyRent: s.base_rent, status: s.status } : null,
      };
    });
    // Pending first, oldest pending at the top so nobody waits forever.
    data.sort((a, b) =>
      a.status === "PENDING" && b.status === "PENDING"
        ? a.createdAt.localeCompare(b.createdAt)
        : (a.status === "PENDING" ? 0 : 1) - (b.status === "PENDING" ? 0 : 1),
    );
    return { success: true, data };
  } catch (e) {
    return errorOf(e, "Couldn't load rent requests.");
  }
}

/** Short-lived link to one of a tenant's onboarding documents. */
export async function getTenantDocumentLinkAction(tenantId: string, type: string) {
  try {
    await requireStaff("leasing");
    const tenant = await prisma.tenant.findUnique({ where: { id: String(tenantId) }, select: { documents: true } });
    const docs = Array.isArray(tenant?.documents) ? (tenant!.documents as TenantDocument[]) : [];
    const doc = docs.find((d) => d.type === type);
    if (!doc) return fail("Document not found.");
    return { success: true as const, url: await privateFileUrl(doc.url, doc.key) };
  } catch (e) {
    return errorOf(e, "Couldn't open the document.");
  }
}

/** Cloudinary keeps documents private: sign a download link valid for 5 minutes. */
async function privateFileUrl(url: string, key?: string | null) {
  if (!key?.startsWith("cloudinary:")) return url;
  const [, resourceType, ...rest] = key.split(":");
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !apiKey || !secret) return url;
  const now = Math.floor(Date.now() / 1000);
  const params: Record<string, string> = {
    public_id: rest.join(":"),
    timestamp: String(now),
    expires_at: String(now + 300),
    type: "upload",
  };
  const toSign = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
  const { createHash } = await import("crypto");
  const signature = createHash("sha1").update(toSign + secret).digest("hex");
  return (
    `https://api.cloudinary.com/v1_1/${cloud}/${resourceType}/download?` +
    new URLSearchParams({ ...params, api_key: apiKey, signature }).toString()
  );
}

export type PaymentForm = {
  months: number;
  amount: number;
  /** YYYY-MM-DD, Manila */
  paidOn: string;
  method: string;
  referenceNo?: string;
};

function checkPayment(p: PaymentForm) {
  const months = Number(p?.months);
  const amount = Math.round(Number(p?.amount) * 100) / 100;
  const method = String(p?.method ?? "");
  const paidOn = String(p?.paidOn ?? "");
  if (!Number.isInteger(months) || months < 1 || months > MAX_MONTHS) throw new UserError(`Months must be 1 to ${MAX_MONTHS}.`);
  if (!Number.isFinite(amount) || amount <= 0) throw new UserError("Enter the amount received.");
  if (!(PAYMENT_METHODS as readonly string[]).includes(method)) throw new UserError("Choose how they paid.");
  if (!YMD.test(paidOn)) throw new UserError("Enter the payment date.");
  const paidAt = phDayStart(paidOn);
  if (Number.isNaN(paidAt.getTime()) || paidAt.getTime() > Date.now() + 24 * 3600_000) {
    throw new UserError("The payment date can't be in the future.");
  }
  return { months, amount, method, paidAt, referenceNo: String(p?.referenceNo ?? "").trim().slice(0, 100) || null };
}

export async function approveRentRequestAction(
  requestId: string,
  form: PaymentForm & { startOn: string; monthlyRent: number; comment?: string },
) {
  try {
    const staff = await requireStaff("leasing");
    const pay = checkPayment(form);
    const monthlyRent = Math.round(Number(form?.monthlyRent) * 100) / 100;
    if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) return fail("Enter the monthly rent.");
    if (!YMD.test(String(form?.startOn ?? ""))) return fail("Enter the lease start date.");
    const start = phDayStart(form.startOn);
    const comment = String(form?.comment ?? "").trim().slice(0, 1000) || null;

    const result = await prisma.$transaction(async (tx) => {
      const req = await tx.rentRequest.findUnique({
        where: { id: String(requestId) },
        include: { tenant: { select: { id: true, userId: true, shopName: true, status: true } } },
      });
      if (!req || req.status !== "PENDING") throw new UserError("This request was already decided.");
      if (!["ACTIVE", "PENDING"].includes(req.tenant.status)) {
        throw new UserError(`This tenant's account is ${req.tenant.status.toLowerCase()}. Reactivate it first.`);
      }

      const claimed = await tx.areaSlot.updateMany({
        where: { unit_id: req.unitId, status: "AVAILABLE" },
        data: { status: "OCCUPIED", tenant_id: req.tenant.userId },
      });
      if (!claimed.count) throw new UserError(`Unit ${req.unitId} is not available any more. Reject this request instead.`);

      const lease = await tx.lease.create({
        data: {
          tenantId: req.tenant.id,
          unitId: req.unitId,
          startDate: start,
          endDate: addMonths(start, pay.months),
          monthlyRent,
        },
      });
      const invoice = await createPaidInvoice(tx, {
        ...pay,
        tenantId: req.tenant.id,
        leaseId: lease.id,
        unitId: req.unitId,
        monthlyRent,
        periodStart: start,
        kind: "New lease",
      });
      await tx.rentRequest.update({
        where: { id: req.id },
        data: { status: "APPROVED", adminComment: comment, decidedById: staff.id, decidedAt: new Date(), leaseId: lease.id },
      });
      // Anyone else waiting on this space hears it's gone.
      const others = await tx.rentRequest.findMany({
        where: { unitId: req.unitId, status: "PENDING", id: { not: req.id } },
        select: { id: true, tenant: { select: { userId: true } } },
      });
      await tx.rentRequest.updateMany({
        where: { id: { in: others.map((o) => o.id) } },
        data: { status: "REJECTED", adminComment: "This space was rented to another tenant.", decidedById: staff.id, decidedAt: new Date() },
      });
      await syncTenantUnit(tx, req.tenant.id);
      return { req, lease, invoice, others: others.map((o) => o.tenant.userId) };
    });

    const { req, lease, invoice } = result;
    after(async () => {
      await notify("MERCHANT_APPLICATION_UPDATE", {
        recipients: [req.tenant.userId],
        title: `Rent request approved: Unit ${req.unitId}`,
        message: `Unit ${req.unitId} is yours from ${formatPHDate(lease.startDate)}, paid through ${formatPHDate(lease.endDate)}.${comment ? ` Note from the office: ${comment}` : ""}`,
        link: "/tenantdashboard/rent-a-space",
        email: false,
      });
      await sendInvoiceNotice(req.tenant.userId, invoice, req.unitId);
      if (result.others.length) {
        await notify("MERCHANT_APPLICATION_UPDATE", {
          recipients: result.others,
          title: `Rent request closed: Unit ${req.unitId}`,
          message: `Unit ${req.unitId} was rented to another tenant. You can request a different space.`,
          link: "/tenantdashboard/rent-a-space",
          email: false,
        });
      }
    });
    revalidateLeasing();
    return { success: true as const, invoiceId: invoice.id };
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") return fail("This space already has an active lease.");
    return errorOf(e, "Couldn't approve the request.");
  }
}

export async function rejectRentRequestAction(requestId: string, reason: string) {
  try {
    const staff = await requireStaff("leasing");
    const why = String(reason ?? "").trim().slice(0, 1000);
    if (why.length < 3) return fail("Write the reason. The tenant will see it.");
    const req = await prisma.rentRequest.findUnique({
      where: { id: String(requestId) },
      select: { status: true, unitId: true, tenant: { select: { userId: true } } },
    });
    const done = await prisma.rentRequest.updateMany({
      where: { id: String(requestId), status: "PENDING" },
      data: { status: "REJECTED", adminComment: why, decidedById: staff.id, decidedAt: new Date() },
    });
    if (!done.count || !req) return fail("This request was already decided.");
    after(() =>
      notify("MERCHANT_APPLICATION_UPDATE", {
        recipients: [req.tenant.userId],
        title: `Rent request declined: Unit ${req.unitId}`,
        message: `Your request for Unit ${req.unitId} was declined. Reason: ${why}`,
        link: "/tenantdashboard/rent-a-space",
        email: false,
      }),
    );
    revalidateLeasing();
    return { success: true as const };
  } catch (e) {
    return errorOf(e, "Couldn't reject the request.");
  }
}

// ---------------------------------------------------------------------------
// Staff: renewals
// ---------------------------------------------------------------------------

export type RenewalRow = {
  id: string;
  unitId: string;
  floor: string | null;
  tenantId: string;
  shopName: string;
  ownerName: string | null;
  startDate: string;
  endDate: string;
  graceEnds: string;
  monthlyRent: number;
  status: string;
  stage: RenewalStage | null;
  endReason: string | null;
  endedAt: string | null;
  lastInvoiceId: string | null;
};

export async function listRenewalsAction(): Promise<
  { success: true; data: { leases: RenewalRow[]; settings: LeaseSettingsData } } | Fail
> {
  try {
    await requireStaff("leasing");
    await reconcileLeases();
    const settings = await getLeaseSettings();
    const since = new Date(Date.now() - 90 * 24 * 3600_000);
    const leases = await prisma.lease.findMany({
      where: { OR: [{ status: "ACTIVE" }, { status: "ENDED", endedAt: { gte: since } }] },
      orderBy: { endDate: "asc" },
      include: {
        tenant: { select: { shopName: true, user: { select: { name: true } } } },
        invoices: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } },
      },
    });
    const floors = new Map(
      (
        await prisma.areaSlot.findMany({
          where: { unit_id: { in: leases.map((l) => l.unitId) } },
          select: { unit_id: true, floor: true },
        })
      ).map((s) => [s.unit_id, s.floor]),
    );
    return {
      success: true,
      data: {
        settings,
        leases: leases.map((l) => ({
          id: l.id,
          unitId: l.unitId,
          floor: floors.get(l.unitId) ?? null,
          tenantId: l.tenantId,
          shopName: l.tenant.shopName,
          ownerName: l.tenant.user.name,
          startDate: l.startDate.toISOString(),
          endDate: l.endDate.toISOString(),
          graceEnds: graceEndDate(l.endDate, settings).toISOString(),
          monthlyRent: l.monthlyRent,
          status: l.status,
          stage: l.status === "ACTIVE" ? renewalStage(l.endDate, settings) : null,
          endReason: l.endReason,
          endedAt: l.endedAt?.toISOString() ?? null,
          lastInvoiceId: l.invoices[0]?.id ?? null,
        })),
      },
    };
  } catch (e) {
    return errorOf(e, "Couldn't load renewals.");
  }
}

export async function recordRenewalAction(leaseId: string, form: PaymentForm) {
  try {
    await requireStaff("leasing");
    const pay = checkPayment(form);
    const out = await prisma.$transaction(async (tx) => {
      const lease = await tx.lease.findUnique({
        where: { id: String(leaseId) },
        include: { tenant: { select: { userId: true } } },
      });
      if (!lease || lease.status !== "ACTIVE") {
        throw new UserError("This lease has ended. The tenant needs to send a new rent request.");
      }
      const newEnd = addMonths(lease.endDate, pay.months);
      const moved = await tx.lease.updateMany({
        where: { id: lease.id, status: "ACTIVE", endDate: lease.endDate },
        data: { endDate: newEnd, noticesSent: [] },
      });
      if (!moved.count) throw new UserError("Someone just updated this lease. Reload and try again.");
      const invoice = await createPaidInvoice(tx, {
        ...pay,
        tenantId: lease.tenantId,
        leaseId: lease.id,
        unitId: lease.unitId,
        monthlyRent: lease.monthlyRent,
        periodStart: lease.endDate,
        kind: "Renewal",
      });
      return { lease, newEnd, invoice };
    });
    after(async () => {
      await notify("PAYMENT_CONFIRMED", {
        recipients: [out.lease.tenant.userId],
        title: `Lease renewed: Unit ${out.lease.unitId}`,
        message: `Thank you. Unit ${out.lease.unitId} is now paid through ${formatPHDate(out.newEnd)} (${peso(out.invoice.amount)}).`,
        link: "/tenantdashboard/rent-a-space",
        email: false,
      });
      await sendInvoiceNotice(out.lease.tenant.userId, out.invoice, out.lease.unitId);
    });
    revalidateLeasing();
    return { success: true as const, invoiceId: out.invoice.id };
  } catch (e) {
    return errorOf(e, "Couldn't record the renewal.");
  }
}

/** Staff ends a lease by hand (tenant moves out). */
export async function endLeaseAction(leaseId: string, reason: string) {
  try {
    await requireStaff("leasing");
    const why = String(reason ?? "").trim().slice(0, 500);
    if (why.length < 3) return fail("Write the reason.");
    const lease = await prisma.lease.findUnique({
      where: { id: String(leaseId) },
      select: { unitId: true, tenant: { select: { userId: true } } },
    });
    if (!lease || !(await endLease(String(leaseId), why))) return fail("This lease already ended.");
    after(() =>
      notify("EXPIRING_CONTRACTS", {
        recipients: [lease.tenant.userId],
        title: `Lease ended: Unit ${lease.unitId}`,
        message: `Your lease for Unit ${lease.unitId} was ended by the management office. Reason: ${why}`,
        link: "/tenantdashboard/rent-a-space",
      }),
    );
    revalidateLeasing();
    return { success: true as const };
  } catch (e) {
    return errorOf(e, "Couldn't end the lease.");
  }
}

export async function saveLeaseSettingsAction(input: LeaseSettingsData) {
  try {
    await requireStaff("leasing");
    const clean = cleanSettings(input);
    if (typeof clean === "string") return fail(clean);
    await prisma.leaseSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...clean }, update: clean });
    revalidatePath("/admindashboard/renewals");
    return { success: true as const, settings: clean };
  } catch (e) {
    return errorOf(e, "Couldn't save the settings.");
  }
}

function revalidateLeasing() {
  revalidatePath("/admindashboard/rent-requests");
  revalidatePath("/admindashboard/renewals");
  revalidatePath("/admindashboard/space-manager");
  revalidatePath("/tenantdashboard/rent-a-space");
  revalidatePath("/available-spaces");
}
