"use client";

import { useState } from "react";
import { Button } from "@cloudflare/kumo";
import { UploadSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { submitDepositSlip } from "@/app/actions/finance";
import type { BillToPay } from "@/app/actions/workspace";
import { peso } from "@/lib/leasing";
import { formatPHDate } from "@/lib/ph-date";

/**
 * Unpaid bills with the two ways to settle them: pay at the mall office, or
 * upload the bank deposit slip for the office to check.
 */
export function BillsToPay({ bills, onSubmitted }: { bills: BillToPay[]; onSubmitted: () => void }) {
  const [uploading, setUploading] = useState<string | null>(null);
  const toPay = bills.filter((b) => !b.checking).reduce((sum, b) => sum + b.amount, 0);

  const upload = async (bill: BillToPay, file: File) => {
    setUploading(bill.id);
    try {
      const { getCloudStorageProvider } = await import("@/lib/cloud-storage");
      const { shrinkImage } = await import("@/lib/shrink-image");
      const stored = await getCloudStorageProvider().uploadFile(await shrinkImage(file), "receipts");
      const res = await submitDepositSlip(bill.id, stored.url, stored.key);
      if (!res.success) {
        toast.error(res.error || "Couldn't send the deposit slip.");
        return;
      }
      toast.success("Deposit slip sent. The mall office will check it.");
      onSubmitted();
    } catch (error) {
      console.error("Deposit slip upload failed:", error);
      toast.error("Couldn't upload the photo. Please try again.");
    } finally {
      setUploading(null);
    }
  };

  return (
    <section className="space-y-3" aria-labelledby="bills-heading">
      <div>
        <h2 id="bills-heading" className="text-lg font-semibold text-kumo-default">
          Bills to pay
        </h2>
        <p className="text-sm text-kumo-subtle">
          {toPay > 0 ? `${peso(toPay)} to pay. ` : ""}Pay at the SR Mall management office, or deposit to the bank and
          upload a photo of the deposit slip here.
        </p>
      </div>
      <ul className="divide-y divide-kumo-line rounded-xl border border-kumo-line bg-kumo-base">
        {bills.map((b) => (
          <li key={b.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-kumo-default">{b.description}</p>
              <p className="text-sm text-kumo-subtle">
                {b.invoiceNumber}
                {b.unitId ? `, Unit ${b.unitId}` : ""}.{" "}
                <span className={b.overdue && !b.checking ? "font-medium text-kumo-danger" : undefined}>
                  {b.overdue ? "Overdue since" : "Due"} {formatPHDate(b.dueDate)}
                </span>
              </p>
            </div>
            <div className="flex items-center justify-between gap-4 sm:justify-end">
              <span className="text-base font-semibold text-kumo-default">{peso(b.amount)}</span>
              {b.checking ? (
                <span className="text-sm font-medium text-kumo-warning">Slip sent, being checked</span>
              ) : (
                <Button
                  variant="primary"
                  icon={<UploadSimple />}
                  loading={uploading === b.id}
                  disabled={uploading !== null}
                  onClick={() => document.getElementById(`slip-${b.id}`)?.click()}
                >
                  Upload deposit slip
                </Button>
              )}
              <input
                id={`slip-${b.id}`}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void upload(b, file);
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
