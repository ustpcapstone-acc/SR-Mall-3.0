"use client";

import { useEffect, useState } from "react";
import { Banner, Button, InputArea, Loader, cn } from "@cloudflare/kumo";
import { ArrowSquareOut, DownloadSimple } from "@phosphor-icons/react";
import { AdminDialog, Person } from "@/components/admin/page-kit";
import { approveReservationAction, getPermitLinkAction, rejectReservationAction } from "@/app/actions/space-slot";
import { useAuth } from "@/app/providers";
import { useFloors } from "@/lib/use-floors";
import { useDraft } from "@/lib/drafts/use-draft";
import { DraftNote } from "@/components/drafts/draft-note";
import { ReservationStepper } from "@/components/reservation-stepper";

export interface ReservationRow {
  unit_id: string;
  sqm_size?: number | null;
  base_rent?: number | null;
  floor?: string | null;
  reservedAt?: string | null;
  remainingFormatted?: string | null;
  isUrgent?: boolean;
  reservingUser?: { name?: string | null; email?: string | null; avatarUrl?: string | null } | null;
  /** Business permit the applicant uploaded with the reservation. */
  permit?: { url: string; name: string; type: string; size: number; uploadedAt: string } | null;
}

export type ReservationModalMode = "details" | "approve" | "reject";

const COMMENT_MAX = 1000;
const fileSize = (n: number) => (n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const when = (value: string) =>
  new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const isImage = (p: { type?: string; url: string }) => (p.type || "").startsWith("image/") || /\.(png|jpe?g)(\?|$)/i.test(p.url);

/**
 * Space reservation (admin Bookings → Space Reservations): "See details"
 * shows who reserved what and their business permit; Approve / Reject add a
 * comment for the applicant (required for reject) that goes into their email
 * and notification.
 */
export function ReservationDecisionModal({
  reservation: r,
  action,
  onClose,
  onDone,
}: {
  reservation: ReservationRow;
  action: ReservationModalMode;
  onClose: () => void;
  /** Called after the server accepted or refused (so the list can refresh). */
  onDone: () => void;
}) {
  const { user } = useAuth();
  const { label: floorLabel } = useFloors();
  const [mode, setMode] = useState<ReservationModalMode>(action);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const approve = mode === "approve";
  const details = mode === "details";

  useEffect(() => setMode(action), [action]);

  const draft = useDraft({
    form: "admin.reservation-decision",
    scope: [r.unit_id],
    enabled: !details,
    value: { reason },
    initial: { reason: "" },
    onRestore: (saved) => setReason(saved.reason),
  });

  const submit = async () => {
    if (mode === "reject" && !reason.trim()) {
      setError("Please write a comment so the applicant knows why.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await draft.send(async () =>
        approve
          ? await approveReservationAction(r.unit_id, reason.trim() || undefined, user?.id)
          : await rejectReservationAction(r.unit_id, reason.trim(), user?.id),
      );
      if (!res) return;
      if (res.success) {
        draft.clear();
        onDone();
        onClose();
      } else {
        setError(res.error || "Something went wrong.");
        onDone(); // the list is probably out of date (expired / handled elsewhere)
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const name = r.reservingUser?.name || "Registered customer";
  const permit = r.permit || null;

  // Permits are private: preview / View / Download use a short-lived signed link.
  const [preview, setPreview] = useState<string | null>(null);
  const [opening, setOpening] = useState<"view" | "download" | null>(null);
  useEffect(() => {
    setPreview(null);
    if (!permit || !isImage(permit)) return;
    let alive = true;
    getPermitLinkAction(user?.id, r.unit_id).then((res) => alive && res.success && setPreview(res.url));
    return () => {
      alive = false;
    };
  }, [permit?.url, r.unit_id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const openPermit = async (how: "view" | "download") => {
    // Open the tab first (synchronously) so pop-up blockers allow it.
    const tab = how === "view" ? window.open("about:blank", "_blank") : null;
    setOpening(how);
    try {
      const res = await getPermitLinkAction(user?.id, r.unit_id);
      if (!res.success) {
        tab?.close();
        setError(res.error);
        return;
      }
      if (tab) tab.location.href = res.url;
      else {
        const a = document.createElement("a");
        a.href = res.url;
        a.download = permit?.name || "business-permit";
        a.rel = "noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch {
      tab?.close();
      setError("Couldn't open the business permit. Try again.");
    } finally {
      setOpening(null);
    }
  };

  return (
    <AdminDialog
      open
      onClose={() => !busy && onClose()}
      title={details ? `Unit ${r.unit_id} details` : `${approve ? "Approve" : "Reject"} Unit ${r.unit_id}?`}
      description="Space reservation"
      footer={
        details ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button variant="secondary-destructive" onClick={() => { setError(null); setMode("reject"); }}>
              Reject
            </Button>
            <Button variant="primary" onClick={() => { setError(null); setMode("approve"); }}>
              Approve
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant={approve ? "primary" : "destructive"}
              loading={busy}
              disabled={!approve && !reason.trim()}
              onClick={submit}
            >
              {approve ? "Approve reservation" : "Reject & release unit"}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-5">
        <ReservationStepper current={approve ? 3 : 2} />

        {/* Who */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-kumo-recessed p-3">
          <Person name={name} detail={r.reservingUser?.email || "No email on file"} image={r.reservingUser?.avatarUrl} />
          <p className={cn("shrink-0 text-sm font-semibold", r.isUrgent ? "text-kumo-danger" : "text-kumo-warning")}>
            {r.remainingFormatted ? `${r.remainingFormatted.replace(/ left$/i, "")} left` : ""}
          </p>
        </div>

        {/* What */}
        <dl className="grid grid-cols-3 gap-3">
          <Fact label="Floor">
            {floorLabel(r.floor) || "-"}
          </Fact>
          <Fact label="Size">{r.sqm_size ?? "-"} sqm</Fact>
          <Fact label="Rent">₱{Number(r.base_rent || 0).toLocaleString()}</Fact>
        </dl>
        {r.reservedAt && <p className="text-sm text-kumo-subtle">Reserved {when(r.reservedAt)}</p>}

        {/* Business permit */}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-kumo-default">Business permit</h3>
          {permit ? (
            <div className="overflow-hidden rounded-lg border border-kumo-line">
              {isImage(permit) ? (
                <button type="button" onClick={() => openPermit("view")} className="block w-full cursor-pointer bg-kumo-recessed">
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="Business permit" className="max-h-64 w-full object-contain" />
                  ) : (
                    <span className="flex items-center justify-center py-10">
                      <Loader />
                    </span>
                  )}
                </button>
              ) : (
                <p className="bg-kumo-recessed py-6 text-center text-sm text-kumo-subtle">PDF document</p>
              )}
              <div className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-kumo-default">{permit.name}</p>
                  <p className="text-xs text-kumo-subtle">
                    {permit.size ? `${fileSize(permit.size)}, ` : ""}uploaded {when(permit.uploadedAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<ArrowSquareOut />}
                  loading={opening === "view"}
                  disabled={!!opening}
                  onClick={() => openPermit("view")}
                >
                  View
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<DownloadSimple />}
                  loading={opening === "download"}
                  disabled={!!opening}
                  onClick={() => openPermit("download")}
                >
                  Download
                </Button>
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-kumo-line p-3 text-sm text-kumo-subtle">
              No permit uploaded (this reservation was made before permits were required).
            </p>
          )}
        </section>

        {/* What happens */}
        {!details && (
          <p className="text-sm text-kumo-default">
            {approve ? (
              <>
                Unit {r.unit_id} becomes <strong>Occupied</strong> and {name} gets an approval email and notification. The
                leasing team should then schedule the site visit and contract.
              </>
            ) : (
              <>
                Unit {r.unit_id} goes back to <strong>Available</strong> for other customers, and {name} is notified by
                email and in the app.
              </>
            )}
          </p>
        )}

        {!details && (
          <InputArea
            label={approve ? "Comment to the applicant (optional)" : "Comment to the applicant (required)"}
            description={`Sent to ${name} by email and notification. ${reason.length}/${COMMENT_MAX}`}
            value={reason}
            onValueChange={(v) => setReason(v.slice(0, COMMENT_MAX))}
            rows={3}
            placeholder={
              approve
                ? "e.g. Please visit the admin office on Monday at 9 AM to sign the contract."
                : "e.g. The business permit has expired. Please reserve again with a valid permit."
            }
            className="w-full"
          />
        )}

        {!details && <DraftNote draft={draft} />}

        {error && <Banner variant="error" description={error} />}
      </div>
    </AdminDialog>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-kumo-line p-3">
      <dt className="text-xs text-kumo-subtle">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-kumo-default">{children}</dd>
    </div>
  );
}
