"use client";

import { useFloors } from "@/lib/use-floors";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AreaSlot } from "@srmall/database";
import { Button, Checkbox, cn } from "@cloudflare/kumo";
import { CaretLeft, CaretRight, Storefront, X } from "@phosphor-icons/react";
import { useAuth } from "@/app/providers";
import { reserveSlotAction } from "@/app/actions/space-slot";
import { toast } from "sonner";
import { announceSlotChange } from "@/lib/slot-live";
import { ReservationStepper } from "@/components/reservation-stepper";
import {
  PERMIT_FOLDER,
  PERMIT_MAX_BYTES,
  PERMIT_TYPES,
  RESERVATION_HOLD_LABEL,
} from "@/lib/reservation-window";

const PERMIT_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

type Permit = { url: string; name: string; type: string; size: number; key?: string };

const fileSize = (n: number) => (n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

interface SpaceDetailModalProps {
  slot: AreaSlot;
  onClose: () => void;
  onInquire?: (unitId: string) => void;
  onLoginRequired?: () => void;
  /** Staff checking the listing: shows it without Reserve or Ask. */
  preview?: boolean;
}

export default function SpaceDetailModal({
  slot,
  onClose,
  onInquire,
  onLoginRequired,
  preview,
}: SpaceDetailModalProps) {
  const { label: floorLabel } = useFloors();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isReserving, setIsReserving] = useState(false);
  // Confirmation step before the reservation is actually submitted
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  // Business permit (required) and the "in process" screen after submitting
  const [permit, setPermit] = useState<Permit | null>(null);
  const [uploadingPermit, setUploadingPermit] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // Live status: flips to RESERVED/OCCUPIED if someone else got the unit first
  const [status, setStatus] = useState<string>(slot.status);
  // Follow live updates from the page (someone else reserved it while open)
  useEffect(() => setStatus(slot.status), [slot.status]);
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  // This person's own reservation, waiting for the admin's review
  const isMyReservation =
    status === "RESERVED" && !!user?.id && ((slot as any).tenant_id === user.id || submitted);
  // Tenants already hold a unit and cannot reserve a second one.
  const isTenant = user?.role === "TENANT";

  // Images are now a native array in PostgreSQL
  const images: string[] = Array.isArray(slot.space_images)
    ? slot.space_images
    : [];

  // Only what the mall office entered for this unit.
  const features: string[] = Array.isArray((slot as any).features) ? (slot as any).features : [];

  const handleInquiry = () => {
    if (onInquire) {
      onInquire(slot.unit_id);
    } else {
      // Fallback or default behavior
      router.push(`/?recipient=admin&unit=${encodeURIComponent(slot.unit_id)}`);
      onClose();
    }
  };

  // Step 1: checks, then show the confirmation dialog (nothing is submitted yet)
  const handleReservation = () => {
    if (!isAuthenticated || !user) {
      if (onLoginRequired) onLoginRequired();
      else toast.error("Please log in to reserve a unit.");
      return;
    }
    if (user.role === "TENANT") {
      toast.error("You're already a tenant", {
        description:
          "A tenant account can only hold one unit. Contact mall administration if you need a different space.",
      });
      return;
    }
    if (status !== "AVAILABLE") {
      toast.error("Unit unavailable", {
        description: "This unit has already been reserved or occupied.",
      });
      return;
    }
    setAgreed(false);
    setConfirmError(null);
    setPermit(null);
    setSubmitted(false);
    setConfirmOpen(true);
  };

  const uploadPermit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!PERMIT_TYPES.includes(file.type)) {
      setConfirmError("Please upload a PDF, JPG or PNG file.");
      return;
    }
    if (file.size > PERMIT_MAX_BYTES) {
      setConfirmError("The file must be 10 MB or smaller.");
      return;
    }
    setConfirmError(null);
    setUploadingPermit(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", PERMIT_FOLDER);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");
      setPermit({ url: data.url, name: file.name, type: file.type, size: file.size, key: data.key });
    } catch (err: any) {
      setConfirmError(`Couldn't upload the file: ${err?.message || "please try again"}`);
    } finally {
      setUploadingPermit(false);
    }
  };

  // Step 2: the customer confirmed → submit
  const submitReservation = async () => {
    if (!user || !agreed || !permit) return;
    setIsReserving(true);
    setConfirmError(null);
    try {
      const res: any = await reserveSlotAction(slot.unit_id, user.id, user.name || "Customer", permit);
      if (res.success) {
        setStatus("RESERVED");
        // Update this tab's lists right away (other tabs get it via realtime)
        announceSlotChange({ id: slot.id, status: "RESERVED", tenant_id: user.id });
        // Show the "in process" screen instead of closing straight away.
        setSubmitted(true);
        toast.success(`Unit ${slot.unit_id} reserved · in process`, {
          description: `Your business permit is being reviewed (up to ${RESERVATION_HOLD_LABEL}). You'll get an email and a notification with the decision.`,
          duration: 7000,
        });
      } else {
        if (res.code === "UNAVAILABLE" && res.status) {
          setStatus(res.status);
          announceSlotChange({ id: slot.id, status: res.status, tenant_id: null });
        }
        setConfirmError(res.error || "The reservation could not be processed right now.");
      }
    } catch {
      setConfirmError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsReserving(false);
    }
  };

  const nextImage = () => {
    if (images.length === 0) return;
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    if (images.length === 0) return;
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const statusLabel = status === "AVAILABLE" ? "Available" : status === "RESERVED" ? "Reserved" : "Occupied";
  const statusTone =
    status === "AVAILABLE" ? "text-kumo-success" : status === "RESERVED" ? "text-kumo-warning" : "text-kumo-danger";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="space-title"
        className="relative flex max-h-[96vh] w-full max-w-4xl flex-col overflow-y-auto rounded-t-2xl border border-kumo-line bg-kumo-base shadow-2xl sm:max-h-[90vh] sm:rounded-2xl md:flex-row md:overflow-hidden"
      >
        <div className="absolute right-3 top-3 z-20">
          <Button variant="secondary" shape="square" icon={<X />} aria-label="Close" onClick={onClose} />
        </div>

        {/* Photos */}
        <div className="relative h-64 w-full shrink-0 bg-kumo-recessed sm:h-80 md:h-auto md:min-h-[28rem] md:w-1/2">
          {images.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={images[currentImageIndex]}
              alt={`Unit ${slot.unit_id}, photo ${currentImageIndex + 1}`}
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-kumo-subtle">
              <Storefront size={40} aria-hidden />
              <p className="text-sm">No photo yet</p>
            </div>
          )}
          {images.length > 1 && (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-black/60 p-2">
              <Button variant="secondary" size="sm" shape="square" icon={<CaretLeft />} aria-label="Previous photo" onClick={prevImage} />
              <p className="text-sm font-medium tabular-nums text-white">
                Photo {currentImageIndex + 1} of {images.length}
              </p>
              <Button variant="secondary" size="sm" shape="square" icon={<CaretRight />} aria-label="Next photo" onClick={nextImage} />
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex min-w-0 flex-1 flex-col gap-5 p-5 sm:p-8 md:overflow-y-auto">
          <div className="pr-10">
            <h2 id="space-title" className="font-display text-3xl font-semibold tracking-tight text-kumo-default">
              Unit {slot.unit_id}
            </h2>
            <p className="mt-1 text-sm">
              <span className={cn("font-semibold", statusTone)}>{statusLabel}</span>
              {floorLabel(slot.floor) && <span className="text-kumo-subtle">, {floorLabel(slot.floor)}</span>}
            </p>
          </div>

          <dl className="divide-y divide-kumo-line border-y border-kumo-line">
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-sm text-kumo-subtle">Size</dt>
              <dd className="text-sm font-semibold text-kumo-default">{slot.sqm_size} sqm</dd>
            </div>
            {/* Rent is private, quoted by the leasing team, never shown publicly. */}
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-sm text-kumo-subtle">Rent</dt>
              <dd className="text-right text-sm font-semibold text-kumo-default">Ask the leasing team</dd>
            </div>
          </dl>

          {features.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-kumo-default">Features</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-kumo-subtle">
                {features.map((feat, index) => (
                  <li key={index}>{feat}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-auto space-y-3">
            {preview ? (
              <p className="rounded-lg bg-kumo-recessed p-3 text-sm text-kumo-default">
                Preview of what visitors see. Reserving and asking are turned off here.
              </p>
            ) : status === "AVAILABLE" ? (
              <>
                {isTenant ? (
                  <p className="rounded-lg bg-kumo-warning-tint p-3 text-sm text-kumo-default">
                    <strong>You already rent a unit.</strong> A tenant account can only reserve one. Contact the mall office if you
                    need another space.
                  </p>
                ) : (
                  <Button variant="primary" size="lg" className="w-full justify-center" disabled={isReserving} onClick={handleReservation}>
                    Reserve this unit
                  </Button>
                )}
                <Button variant="secondary" size="lg" className="w-full justify-center" onClick={handleInquiry}>
                  Ask about this unit
                </Button>
              </>
            ) : (
              <div className="space-y-3">
                {isMyReservation && <ReservationStepper current={2} compact />}
                <p className="rounded-lg bg-kumo-recessed p-3 text-sm text-kumo-default">
                  {isMyReservation
                    ? `Business permit submitted. The admin is reviewing your documents (up to ${RESERVATION_HOLD_LABEL}).`
                    : status === "OCCUPIED"
                      ? "This unit is already rented."
                      : "Someone reserved this unit. The mall office is reviewing the request."}
                </p>
              </div>
            )}
            {!preview && <p className="text-center text-sm text-kumo-subtle">Every reservation needs approval from the mall office.</p>}
          </div>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => !isReserving && setConfirmOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reserve-title"
            className="relative max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-kumo-line bg-kumo-base p-5 shadow-2xl sm:p-6"
          >
            {submitted ? (
              <div className="space-y-4">
                <div>
                  <h2 id="reserve-title" className="font-display text-xl font-semibold text-kumo-default">
                    Unit {slot.unit_id} is held for you
                  </h2>
                  <p className="text-sm font-medium text-kumo-warning">In process</p>
                </div>
                <ReservationStepper current={2} />
                <p className="text-sm text-kumo-default">
                  Your business permit was submitted. The admin reviews your documents before approving, which usually takes up to{" "}
                  <strong>{RESERVATION_HOLD_LABEL}</strong>. You&apos;ll get an email and a notification with the decision and the
                  admin&apos;s comment.
                </p>
                {permit && <p className="truncate rounded-lg bg-kumo-recessed p-3 text-sm text-kumo-default">{permit.name}</p>}
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full justify-center"
                  onClick={() => {
                    setConfirmOpen(false);
                    onClose();
                  }}
                >
                  Done
                </Button>
              </div>
            ) : (
              <>
                <h2 id="reserve-title" className="font-display text-xl font-semibold text-kumo-default">
                  Reserve Unit {slot.unit_id}?
                </h2>
                <ReservationStepper current={1} />
                <dl className="grid grid-cols-2 gap-3 rounded-lg bg-kumo-recessed p-4 text-sm">
                  {[
                    ["Unit", slot.unit_id],
                    ["Floor", floorLabel(slot.floor) || "Not set"],
                    ["Size", `${slot.sqm_size} sqm`],
                    ["Rent", "Ask the leasing team"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-kumo-subtle">{label}</dt>
                      <dd className="font-semibold text-kumo-default">{value}</dd>
                    </div>
                  ))}
                </dl>

                <ul className="list-disc space-y-1 pl-5 text-sm text-kumo-subtle">
                  <li>
                    The unit is held while the admin reviews your business permit (up to <strong>{RESERVATION_HOLD_LABEL}</strong>),
                    then released if no decision is made.
                  </li>
                  <li>The leasing team reviews your request and contacts you. This is not yet a lease contract.</li>
                  <li>You can have one active reservation at a time.</li>
                </ul>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-kumo-default">Business permit (required)</p>
                  {permit ? (
                    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-kumo-line p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-kumo-default">{permit.name}</p>
                        <p className="text-sm text-kumo-success">{fileSize(permit.size)}, uploaded</p>
                      </div>
                      <label className="cursor-pointer text-sm font-semibold text-primary hover:underline">
                        Replace
                        <input type="file" accept={PERMIT_ACCEPT} className="sr-only" onChange={uploadPermit} />
                      </label>
                      <button
                        type="button"
                        onClick={() => setPermit(null)}
                        className="cursor-pointer text-sm font-semibold text-kumo-danger hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label
                      className={cn(
                        "block cursor-pointer rounded-lg border border-dashed border-kumo-line p-4 focus-within:ring-2 focus-within:ring-primary hover:border-primary",
                        uploadingPermit && "pointer-events-none opacity-60",
                      )}
                    >
                      <span className="block text-sm font-semibold text-kumo-default">
                        {uploadingPermit ? "Uploading..." : "Upload your business permit"}
                      </span>
                      <span className="block text-sm text-kumo-subtle">PDF, JPG or PNG, up to 10 MB</span>
                      <input type="file" accept={PERMIT_ACCEPT} className="sr-only" onChange={uploadPermit} />
                    </label>
                  )}
                </div>

                <Checkbox
                  label={`I understand and want to reserve Unit ${slot.unit_id}.`}
                  checked={agreed}
                  onCheckedChange={(v) => setAgreed(Boolean(v))}
                />

                {confirmError && (
                  <p role="alert" className="rounded-lg bg-kumo-danger-tint p-3 text-sm font-medium text-kumo-danger">
                    {confirmError}
                  </p>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variant="secondary" disabled={isReserving} onClick={() => setConfirmOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    loading={isReserving}
                    disabled={!agreed || !permit || uploadingPermit || isReserving || status !== "AVAILABLE"}
                    onClick={submitReservation}
                  >
                    Confirm reservation
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
