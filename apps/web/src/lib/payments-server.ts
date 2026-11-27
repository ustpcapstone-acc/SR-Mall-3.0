import type { Prisma } from "@prisma/client";
import { prisma } from "@srmall/database";
import type { PaymentAction } from "@/lib/payments";
import type { StaffPermission } from "@/lib/permissions";

/** Staff who may see bills and act on payments. */
export const PAYMENT_STAFF: StaffPermission[] = ["tenant_monitoring", "payments"];

export type Actor = { id: string; name: string | null };

/** The name written next to what a staff member did. */
export async function staffActor(id: string): Promise<Actor> {
  const user = await prisma.user.findUnique({ where: { id }, select: { name: true, email: true } });
  return { id, name: user?.name || user?.email || null };
}

/** Add one line to the payment history. Lines are never changed or removed. */
export async function logPayment(
  tx: Prisma.TransactionClient,
  entry: {
    invoiceId: string;
    invoiceNumber: string;
    tenantId: string;
    action: PaymentAction;
    amount: number;
    method?: string | null;
    referenceNo?: string | null;
    paidOn?: Date | null;
    reason?: string | null;
    slipUrl?: string | null;
    by: Actor;
  },
) {
  const { by, ...line } = entry;
  const tenant = await tx.tenant.findUnique({ where: { id: line.tenantId }, select: { shopName: true } });
  await tx.paymentLog.create({ data: { ...line, shopName: tenant?.shopName ?? null, actorId: by.id, actorName: by.name } });
}
