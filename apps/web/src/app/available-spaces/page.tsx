"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ChatBox } from "@/components/chat-box";
import { ChatLauncher } from "@/components/chat-launcher";
import { PublicHeader, PublicSearch } from "@/components/public-header";
import { SpaceCard } from "@/components/space-card";
import { Loader2, Store } from "lucide-react";
import { getPublicAreaSlots } from "@/app/actions/space-slot";
import { useAuth } from "@/app/providers";
import { AreaSlot } from "@srmall/database";
import SpaceDetailModal from "@/components/space-detail-modal";
import { ReservationStepper } from "@/components/reservation-stepper";
import { mergeSlotPatch, slotAccess, useLiveSlots } from "@/lib/slot-live";
import { toast } from "sonner";
import { LoginModal } from "@/components/login-modal";

export default function AvailableSpacesPage() {
  const { isAuthenticated, user } = useAuth();
  const [slots, setSlots] = useState<AreaSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<AreaSlot | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInitialShopName, setChatInitialShopName] = useState<string | null>(null);
  const [chatRecipient, setChatRecipient] = useState<"shop" | "admin" | null>(null);
  const [chatInquirySlotId, setChatInquirySlotId] = useState<string | null>(null);

  useEffect(() => {
    fetchSlots();
  }, []);

  const fetchSlots = async (silent = false) => {
    if (!silent) setLoading(true);
    const res = await getPublicAreaSlots();
    if (res.success && res.data) {
      // Filter for Available and Reserved per user preference in public view
      setSlots(res.data.filter(s => s.status === "AVAILABLE" || s.status === "RESERVED"));
    }
    if (!silent) setLoading(false);
  };

  // Live: a unit someone just reserved flips to Pending here without a reload.
  useLiveSlots(
    (patch) => setSlots((prev) => mergeSlotPatch(prev as any, patch) as any),
    () => fetchSlots(true),
  );

  const filteredSlots = slots.filter((slot) => {
    return slot.unit_id.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black font-sans selection:bg-primary selection:text-white">
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
          {loading ? (
            <div className="space-y-3 py-20 text-center">
              <Loader2 size={32} className="mx-auto animate-spin text-primary" />
              <p className="text-sm text-kumo-subtle">Loading spaces...</p>
            </div>
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
                    onOpen={() =>
                      slotAccess(slot as any, user?.id).open
                        ? setSelectedSlot(slot)
                        : toast.info(
                          slot.status === "RESERVED"
                            ? `Unit ${slot.unit_id} is pending: another customer reserved it first. It's released automatically if it isn't confirmed within 2 days.`
                            : `Unit ${slot.unit_id} is already occupied.`,
                        )
                    }
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-kumo-line bg-kumo-base px-6 py-16 text-center">
              <h3 className="font-display text-xl font-semibold text-kumo-default">No spaces found</h3>
              <p className="mt-1 text-sm text-kumo-subtle">
                {searchQuery ? "No unit number matches your search." : "No units are open right now. Check back soon."}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="mt-4 cursor-pointer text-sm font-semibold text-primary hover:underline"
                >
                  Clear search
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
