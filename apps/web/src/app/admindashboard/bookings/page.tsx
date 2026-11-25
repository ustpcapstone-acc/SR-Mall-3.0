"use client";

import React, { useEffect, useState } from "react";
import { Button, InputArea, Table, cn } from "@cloudflare/kumo";
import { ArrowClockwise, CaretLeft, CaretRight, FileText } from "@phosphor-icons/react";
import { AdminDialog, AdminPage, EmptyNote, Panel, Person, Stat, StatRow, PageTabs } from "@/components/admin/page-kit";
import {
  updateInquiryStatusAction,
} from "@/app/actions/inquiry";
import { getBookingsDataAction } from "@/app/actions/bookings";
import { useLiveSlots } from "@/lib/slot-live";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { toast } from "sonner";
import { ReservationDecisionModal } from "@/components/admin/reservation-decision-modal";

// Calendar Helpers
const getDaysInMonth = (year: number, month: number) =>
  new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) =>
  new Date(year, month, 1).getDay();
const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
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

export default function MasterBookingsPage() {
  const [activeTab, setActiveTab] = useState<
    "event" | "reservation"
  >("event");
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Check URL query parameters on mount to set active tab
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "reservation" || tab === "event") {
        setActiveTab(tab);
      }
    }
  }, []);

  // Event Inquiries State
  const [eventInquiries, setEventInquiries] = useState<any[]>([]);
  const [isProcessingEvent, setIsProcessingEvent] = useState<string | null>(
    null,
  );
  const [modalInquiry, setModalInquiry] = useState<any | null>(null);
  const [modalAction, setModalAction] = useState<
    "ACCEPTED" | "REJECTED" | null
  >(null);
  const [feedback, setFeedback] = useState("");

  // Reservation Queue State
  const [reservedSlots, setReservedSlots] = useState<any[]>([]);

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(
    null,
  );
  const [calendarModalEvents, setCalendarModalEvents] = useState<any[]>([]);

  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsSyncing(true);

    try {
      // One request for all tabs (see getBookingsDataAction).
      const { slots, inquiries, reservedDetailed } =
        await getBookingsDataAction();

      if (reservedDetailed.success && reservedDetailed.data) {
        setReservedSlots(reservedDetailed.data);
      } else if (slots.success) {
        setReservedSlots(
          slots.data?.filter((s: any) => s.status === "RESERVED") || [],
        );
      }
      if (inquiries.success) setEventInquiries(inquiries.data || []);
    } catch (err) {
      toast.error("Data synchronization failed");
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // New / changed reservations show up without a reload: any unit status
  // change (Supabase Realtime), tab focus and a 30s fallback refresh quietly.
  useLiveSlots(
    () => loadData(true),
    () => loadData(true),
  );

  // --- Event Handlers ---
  const handleEventActionClick = (
    inquiry: any,
    action: "ACCEPTED" | "REJECTED",
  ) => {
    setModalInquiry(inquiry);
    setModalAction(action);
    setFeedback("");
  };

  const submitEventAction = async () => {
    if (!modalInquiry || !modalAction) return;
    if (modalAction === "REJECTED" && !feedback.trim()) {
      toast.error("Policy: Feedback is required for rejection.");
      return;
    }

    setIsProcessingEvent(modalInquiry.id);
    const result = await updateInquiryStatusAction(
      modalInquiry.id,
      modalAction,
      feedback,
    );
    if (result.success) {
      toast.success(
        `Schedule ${modalAction === "ACCEPTED" ? "Locked" : "Released"}`,
      );
      loadData(true);
      setModalInquiry(null);
    } else {
      toast.error("Execution failure.");
    }
    setIsProcessingEvent(null);
  };

  // --- Reservation Handlers ---
  // Approve / reject open a decision modal (components/admin/reservation-decision-modal)
  const [reservationDecision, setReservationDecision] = useState<{
    reservation: any;
    action: "details" | "approve" | "reject";
  } | null>(null);
  const handleApproveReservation = (unitId: string) => {
    const reservation = reservedSlots.find((r: any) => r.unit_id === unitId) || { unit_id: unitId };
    setReservationDecision({ reservation, action: "approve" });
  };
  const handleRejectReservation = (slot: any) => setReservationDecision({ reservation: slot, action: "reject" });
  const handleReservationDetails = (slot: any) => setReservationDecision({ reservation: slot, action: "details" });

  // --- Calendar Logic ---
  const pendingEvents = eventInquiries.filter((i) => i.status === "PENDING");
  const acceptedEvents = eventInquiries.filter((i) => i.status === "ACCEPTED");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);

  const getEventsForDay = (day: number) => {
    return acceptedEvents.filter((inq) => {
      const inqDate = new Date(inq.eventDate);
      return (
        inqDate.getDate() === day &&
        inqDate.getMonth() === month &&
        inqDate.getFullYear() === year
      );
    });
  };

  const handleDayClick = (day: number) => {
    const events = getEventsForDay(day);
    if (events.length > 0) {
      setSelectedCalendarDate(new Date(year, month, day));
      setCalendarModalEvents(events);
    }
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const upcoming = acceptedEvents.filter((i) => new Date(i.eventDate).getTime() >= Date.now() - 864e5);
  const urgentReservations = reservedSlots.filter((r: any) => r.isUrgent).length;
  const eventsThisMonth = days.reduce((sum, d) => sum + getEventsForDay(d).length, 0);
  const shortDate = (value: string) =>
    new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <AdminPage
      title="Bookings and Reservations"
      description="Manage event inquiries and space reservations in one place."
      actions={
        <Button variant="secondary" icon={<ArrowClockwise />} loading={isSyncing} onClick={() => loadData(true)}>
          Refresh
        </Button>
      }
    >
      <StatRow>
        <Stat
          label="Event requests waiting"
          value={pendingEvents.length}
          tone={pendingEvents.length ? "warning" : "default"}
          onClick={() => setActiveTab("event")}
        />
        <Stat label="Approved events ahead" value={upcoming.length} onClick={() => setActiveTab("event")} />
        <Stat
          label="Reservations waiting"
          value={reservedSlots.length}
          tone={reservedSlots.length ? "warning" : "default"}
          onClick={() => setActiveTab("reservation")}
        />
        <Stat
          label="Expiring within 6 hours"
          value={urgentReservations}
          tone={urgentReservations ? "danger" : "default"}
          onClick={() => setActiveTab("reservation")}
        />
      </StatRow>

      <PageTabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "event" | "reservation")}
        tabs={[
          { value: "event", label: `Event Bookings (${pendingEvents.length})` },
          { value: "reservation", label: `Space Reservations (${reservedSlots.length})` },
        ]}
      />

      {activeTab === "event" && (
        <div className="grid items-start gap-6 xl:grid-cols-5">
          <Panel
            className="xl:col-span-3"
            title="Event requests"
            description={`${pendingEvents.length} waiting for a decision`}
            flush
          >
            {pendingEvents.length === 0 ? (
              <EmptyNote title="No event requests waiting">New inquiries from customers will appear here.</EmptyNote>
            ) : (
              <ul className="divide-y divide-kumo-line">
                {pendingEvents.map((inq) => {
                  const date = new Date(inq.eventDate);
                  return (
                    <li key={inq.id} className="space-y-3 p-4 sm:p-5">
                      <div className="flex gap-4">
                        <div
                          aria-hidden
                          className="flex w-14 shrink-0 flex-col items-center justify-center self-start rounded-lg bg-kumo-recessed py-2"
                        >
                          <span className="text-xs text-kumo-subtle">{date.toLocaleDateString("en-US", { month: "short" })}</span>
                          <span className="text-xl font-semibold tabular-nums text-kumo-default">{date.getDate()}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-semibold text-kumo-default">{inq.eventType}</h3>
                          <p className="text-sm text-kumo-subtle">
                            {shortDate(inq.eventDate)}, {inq.eventTime}
                          </p>
                          <p className="mt-1 break-words text-sm text-kumo-default">
                            {inq.user?.name || "Anonymous User"}
                            {inq.user?.email ? <span className="text-kumo-subtle">, {inq.user.email}</span> : null}
                          </p>
                        </div>
                      </div>
                      <p className="rounded-lg bg-kumo-recessed p-3 text-sm text-kumo-default">
                        {inq.message || "No message provided."}
                      </p>
                      {inq.imageUrl && (
                        <a href={inq.imageUrl} target="_blank" rel="noreferrer" className="block max-w-xs">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={inq.imageUrl}
                            alt="Image attached to the inquiry"
                            className="aspect-video w-full rounded-lg border border-kumo-line object-cover"
                          />
                        </a>
                      )}
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary-destructive" onClick={() => handleEventActionClick(inq, "REJECTED")}>
                          Reject
                        </Button>
                        <Button variant="primary" onClick={() => handleEventActionClick(inq, "ACCEPTED")}>
                          Approve
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel
            className="xl:col-span-2"
            title="Event calendar"
            description={`${eventsThisMonth} approved in ${MONTHS[month]}`}
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <Button variant="secondary" shape="square" icon={<CaretLeft />} aria-label="Previous month" onClick={handlePrevMonth} />
              <p className="text-base font-semibold text-kumo-default" aria-live="polite">
                {MONTHS[month]} {year}
              </p>
              <Button variant="secondary" shape="square" icon={<CaretRight />} aria-label="Next month" onClick={handleNextMonth} />
            </div>

            <div className="grid grid-cols-7 gap-1">
              {DAYS_OF_WEEK.map((d) => (
                <div key={d} className="pb-1 text-center text-xs font-medium text-kumo-subtle">
                  {d}
                </div>
              ))}
              {blanks.map((b) => (
                <div key={`b-${b}`} />
              ))}
              {days.map((d) => {
                const count = getEventsForDay(d).length;
                const isToday =
                  new Date().getDate() === d && new Date().getMonth() === month && new Date().getFullYear() === year;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={!count}
                    onClick={() => handleDayClick(d)}
                    aria-label={`${MONTHS[month]} ${d}${count ? `, ${count} approved event${count === 1 ? "" : "s"}` : ""}`}
                    className={cn(
                      "flex aspect-square flex-col items-center justify-center rounded-lg border text-sm tabular-nums",
                      count
                        ? "cursor-pointer border-kumo-brand bg-kumo-brand font-semibold text-white hover:bg-kumo-brand-hover"
                        : "border-transparent text-kumo-default",
                      isToday && !count && "border-kumo-brand font-semibold text-kumo-brand",
                    )}
                  >
                    {d}
                    {count > 1 && <span className="text-xs font-normal leading-none">{count}</span>}
                  </button>
                );
              })}
            </div>

            <p className="mt-4 border-t border-kumo-line pt-3 text-sm text-kumo-subtle">
              Filled days have approved events. Select one to see them.
            </p>
          </Panel>
        </div>
      )}

      {activeTab === "reservation" && (
        <Panel
          title="Space reservations"
          description="A reservation is rejected automatically after 2 days without a decision."
          flush
        >
          {reservedSlots.length === 0 ? (
            <EmptyNote title="No space reservations waiting">
              New reservations appear here with the time left to review them.
            </EmptyNote>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.Head>Space</Table.Head>
                    <Table.Head>Customer</Table.Head>
                    <Table.Head>Time left</Table.Head>
                    <Table.Head className="text-right">Actions</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {reservedSlots.map((res: any) => (
                    <Table.Row key={res.id}>
                      <Table.Cell>
                        <p className="font-medium text-kumo-default">Unit {res.unit_id}</p>
                        <p className="whitespace-nowrap text-sm text-kumo-subtle">
                          {res.sqm_size} sqm, ₱{res.base_rent?.toLocaleString()} a month
                        </p>
                      </Table.Cell>
                      <Table.Cell>
                        <Person
                          name={res.reservingUser?.name || "Registered customer"}
                          detail={res.reservingUser?.email || "No email available"}
                          image={res.reservingUser?.avatarUrl}
                        />
                        {res.reservedAt && (
                          <p className="mt-1 text-xs text-kumo-subtle">
                            Reserved{" "}
                            {new Date(res.reservedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <p
                          className={cn(
                            "whitespace-nowrap text-sm font-semibold",
                            res.isUrgent ? "text-kumo-danger" : res.isWarning ? "text-kumo-warning" : "text-kumo-success",
                          )}
                        >
                          {res.remainingFormatted || `${res.hoursRemaining ?? 24}h left`}
                        </p>
                        {res.isUrgent && <p className="text-xs text-kumo-subtle">Review soon</p>}
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="secondary" icon={<FileText />} onClick={() => handleReservationDetails(res)}>
                            See details
                          </Button>
                          <Button size="sm" variant="secondary-destructive" onClick={() => handleRejectReservation(res)}>
                            Reject
                          </Button>
                          <Button size="sm" variant="primary" onClick={() => handleApproveReservation(res.unit_id)}>
                            Approve
                          </Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          )}
        </Panel>
      )}

      <AdminDialog
        open={!!modalInquiry}
        onClose={() => setModalInquiry(null)}
        title={`${modalAction === "ACCEPTED" ? "Approve" : "Reject"} this event?`}
        description={
          modalInquiry
            ? `${modalInquiry.eventType} on ${shortDate(modalInquiry.eventDate)}. The customer is told your decision.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalInquiry(null)}>
              Cancel
            </Button>
            <Button
              variant={modalAction === "ACCEPTED" ? "primary" : "destructive"}
              loading={isProcessingEvent !== null}
              disabled={modalAction === "REJECTED" && !feedback.trim()}
              onClick={submitEventAction}
            >
              {modalAction === "ACCEPTED" ? "Approve event" : "Reject event"}
            </Button>
          </>
        }
      >
        <InputArea
          label="Note to the customer"
          description={modalAction === "REJECTED" ? "Say why the event can't be approved." : "Optional"}
          required={modalAction === "REJECTED"}
          value={feedback}
          onValueChange={setFeedback}
          rows={5}
          className="w-full"
        />
      </AdminDialog>

      <AdminDialog
        open={!!selectedCalendarDate}
        onClose={() => setSelectedCalendarDate(null)}
        size="sm"
        title="Events on this day"
        description={selectedCalendarDate?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
      >
        <ul className="divide-y divide-kumo-line rounded-lg border border-kumo-line">
          {calendarModalEvents.map((ev) => (
            <li key={ev.id} className="p-3">
              <p className="text-sm font-semibold text-kumo-default">{ev.eventType}</p>
              <p className="text-sm text-kumo-subtle">
                {ev.eventTime}, {ev.user?.name || "Customer"}
              </p>
              {ev.message && <p className="mt-2 rounded-lg bg-kumo-recessed p-2 text-sm text-kumo-default">{ev.message}</p>}
            </li>
          ))}
        </ul>
      </AdminDialog>

      {reservationDecision && (
        <ReservationDecisionModal
          reservation={reservationDecision.reservation}
          action={reservationDecision.action}
          onClose={() => setReservationDecision(null)}
          onDone={() => loadData(true)}
        />
      )}
    </AdminPage>
  );
}
