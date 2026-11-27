"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ChatBox } from "@/components/chat-box";
import { ChatLauncher } from "@/components/chat-launcher";
import { FilterRow, PublicHeader, PublicSearch } from "@/components/public-header";
import { PublicFloorMap } from "@/components/public-floor-map";
import { SpaceCard } from "@/components/space-card";
import { Loader2, Store } from "lucide-react";
import { getPublicAreaSlots } from "@/app/actions/space-slot";
import { getPublicFloorLayoutsAction } from "@/app/actions/floors";
import { AUTO_LAYOUT, type FloorLayout } from "@/lib/floor-layout";
import { useFloors } from "@/lib/use-floors";
import { useAuth } from "@/app/providers";
import { AreaSlot } from "@srmall/database";
import SpaceDetailModal from "@/components/space-detail-modal";
import { ReservationStepper } from "@/components/reservation-stepper";
import { mergeSlotPatch, slotAccess, useLiveSlots } from "@/lib/slot-live";
import { toast } from "sonner";
import { LoginModal } from "@/components/login-modal";

const SIZES = [
  { id: "any", label: "Any size", fits: () => true },
  { id: "small", label: "Up to 50 sqm", fits: (sqm: number) => sqm <= 50 },
  { id: "medium", label: "51 to 100 sqm", fits: (sqm: number) => sqm > 50 && sqm <= 100 },
  { id: "large", label: "Over 100 sqm", fits: (sqm: number) => sqm > 100 },
];

const VIEWS = [
  { id: "list", label: "List" },
  { id: "map", label: "Floor map" },
];

export default function AvailableSpacesPage() {
  const { isAuthenticated, user } = useAuth();
  const [slots, setSlots] = useState<AreaSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState("list");
  const [floorChoice, setFloorChoice] = useState("all");
  const [sizeChoice, setSizeChoice] = useState("any");
  const [layouts, setLayouts] = useState<Record<string, FloorLayout>>({});
  const { floors } = useFloors();
  const [selectedSlot, setSelectedSlot] = useState<AreaSlot | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInitialShopName, setChatInitialShopName] = useState<string | null>(null);
  const [chatRecipient, setChatRecipient] = useState<"shop" | "admin" | null>(null);
  const [chatInquirySlotId, setChatInquirySlotId] = useState<string | null>(null);

  useEffect(() => {
    fetchSlots();
  }, []);

  // The map's saved positions and floor plans are only needed once it is opened.
  useEffect(() => {
    if (view !== "map") return;
    getPublicFloorLayoutsAction()
      .then((res) => res.success && setLayouts(res.data))
      .catch(() => {});
  }, [view]);

  const fetchSlots = async (silent = false) => {
    if (!silent) setLoading(true);
    const res = await getPublicAreaSlots();
    if (res.success && res.data) {
      // Every unit: the map also draws the taken ones, the list leaves them out.
      setSlots(res.data);
    }
    if (!silent) setLoading(false);
  };

  // Live: a unit someone just reserved flips to Pending here without a reload.
  useLiveSlots(
    (patch) => setSlots((prev) => mergeSlotPatch(prev as any, patch) as any),
    () => fetchSlots(true),
  );

  // Filter for Available and Reserved per user preference in public view
  const listed = slots.filter((s) => s.status === "AVAILABLE" || s.status === "RESERVED");
  // Only floors that have something to rent.
  const floorOptions = floors.filter((f) => listed.some((s) => s.floor === f.id));
  const chosenFloor = floorOptions.some((f) => f.id === floorChoice) ? floorChoice : "all";
  // The map draws one floor at a time.
  const shownFloor = view === "map" && chosenFloor === "all" ? (floorOptions[0]?.id ?? "all") : chosenFloor;
  const size = SIZES.find((s) => s.id === sizeChoice) ?? SIZES[0];
  const filteredSlots = listed.filter(
    (slot) =>
      slot.unit_id.toLowerCase().includes(searchQuery.trim().toLowerCase()) &&
      size.fits(slot.sqm_size) &&
      (shownFloor === "all" || slot.floor === shownFloor),
  );
  const filtering = Boolean(searchQuery) || sizeChoice !== "any" || chosenFloor !== "all";
  const clearFilters = () => {
    setSearchQuery("");
    setSizeChoice("any");
    setFloorChoice("all");
  };
  const onMap = view === "map" && shownFloor !== "all";

  const openSlot = (slot: AreaSlot) =>
    slotAccess(slot as any, user?.id).open
      ? setSelectedSlot(slot)
      : toast.info(
        slot.status === "RESERVED"
          ? `Unit ${slot.unit_id} is pending: another customer reserved it first. It's released automatically if it isn't confirmed within 2 days.`
          : `Unit ${slot.unit_id} is already occupied.`,
      );

  return (
    <div className="min-h-screen bg-kumo-recessed font-sans selection:bg-primary selection:text-white">
      <Navbar />

      <PublicHeader title="Available spaces" description="Units you can rent at SR Mall, from small stalls to large spaces.">
        <PublicSearch value={searchQuery} onChange={setSearchQuery} label="Search unit numbers" placeholder="Search a unit number" />
      </PublicHeader>

      {/* Reservation process */}
      <section className="pt-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="rounded-2xl border border-kumo-line bg-kumo-base p-5 sm:p-6">
            {isAuthenticated && user?.role === "TENANT" && (
              <div className="mb-4 flex items-start gap-3 rounded-xl bg-kumo-warning-tint p-4 text-left">
                <Store size={20} className="mt-0.5 shrink-0 text-kumo-warning" aria-hidden />
                <p className="text-sm text-kumo-default">
                  <strong>You already rent a unit.</strong> A tenant can only reserve one unit here. Contact the mall office if
                  you need another space.
                </p>
              </div>
            )}
            <div className="mb-4">
              <h2 className="font-display text-xl font-semibold tracking-tight text-kumo-default">How reservation works</h2>
              <p className="text-sm text-kumo-subtle">
                Submit your business permit, wait for the office to review it, then receive the approval.
              </p>
            </div>
            <ReservationStepper current={1} />
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="py-8 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          {!loading && listed.length > 0 && (
            <div className="mb-6 space-y-3">
              <FilterRow label="View" options={VIEWS} value={view} onChange={setView} />
              {floorOptions.length > 0 && (
                <FilterRow
                  label="Floor"
                  options={[
                    ...(view === "list" ? [{ id: "all", label: "All floors" }] : []),
                    ...floorOptions.map((f) => ({ id: f.id, label: f.name })),
                  ]}
                  value={shownFloor}
                  onChange={setFloorChoice}
                />
              )}
              <FilterRow label="Size" options={SIZES} value={sizeChoice} onChange={setSizeChoice} />
            </div>
          )}

          {loading ? (
            <div className="space-y-3 py-20 text-center">
              <Loader2 size={32} className="mx-auto animate-spin text-primary" />
              <p className="text-sm text-kumo-subtle">Loading spaces...</p>
            </div>
          ) : onMap ? (
            <>
              <p className="mb-4 text-sm text-kumo-subtle" role="status">
                {filteredSlots.length > 0
                  ? `${filteredSlots.length} ${filteredSlots.length === 1 ? "unit matches" : "units match"} on this floor`
                  : "No unit on this floor matches. Try another floor or size."}
              </p>
              <PublicFloorMap
                key={shownFloor}
                units={slots
                  .filter((s) => s.floor === shownFloor)
                  .sort((a, b) => a.unit_id.localeCompare(b.unit_id, undefined, { numeric: true, sensitivity: "base" }))}
                layout={layouts[shownFloor] ?? AUTO_LAYOUT}
                matches={new Set(filteredSlots.map((s) => s.id))}
                viewerId={user?.id}
                onOpen={openSlot}
              />
            </>
          ) : filteredSlots.length > 0 ? (
            <>
              <p className="mb-4 text-sm text-kumo-subtle">
                Showing {filteredSlots.length} {filteredSlots.length === 1 ? "unit" : "units"}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
                {filteredSlots.map((slot) => (
                  <SpaceCard
                    key={slot.id}
                    slot={slot}
                    viewerId={user?.id}
                    onOpen={() => openSlot(slot)}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-kumo-line bg-kumo-base px-6 py-16 text-center">
              <h3 className="font-display text-xl font-semibold text-kumo-default">No spaces found</h3>
              <p className="mt-1 text-sm text-kumo-subtle">
                {filtering ? "No unit matches your search and filters." : "No units are open right now. Check back soon."}
              </p>
              {filtering && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 cursor-pointer text-sm font-semibold text-primary hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Detail Modals */}
      {selectedSlot && (
        <SpaceDetailModal
          slot={(slots.find((s) => s.id === selectedSlot.id) || selectedSlot) as any}
          onClose={() => setSelectedSlot(null)}
          onLoginRequired={() => setIsLoginModalOpen(true)}
          onInquire={(unitId) => {
            setChatInitialShopName(`Leasing Inquiry for Unit ${unitId}`);
            setChatRecipient("admin");
            setChatInquirySlotId(unitId);
            setIsChatOpen(true);
            setSelectedSlot(null);
          }}
        />
      )}

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />

      <ChatLauncher hidden={isChatOpen} />

      <ChatBox
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        isAuthenticated={isAuthenticated}
        initialShopName={chatInitialShopName}
        initialRecipient={chatRecipient}
        inquirySlotId={chatInquirySlotId}
      />

      <Footer />
    </div>
  );
}
