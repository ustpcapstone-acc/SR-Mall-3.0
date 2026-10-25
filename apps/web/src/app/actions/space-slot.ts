"use server";

import { prisma } from "@srmall/database";
import { emailBaseUrl } from "@/utils/get-base-url";
import { revalidatePath } from "next/cache";
import { notify } from "@/lib/notify";

import {
  PERMIT_MAX_BYTES,
  PERMIT_TYPES,
  RESERVATION_HOLD_LABEL,
  RESERVATION_HOLD_MS,
  RESERVATION_URGENT_MS,
  RESERVATION_WARNING_MS,
} from "@/lib/reservation-window";

/** Text from the admin / applicant going into an HTML email. */
const escapeHtml = (v: string) =>
  v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Close the open (PENDING) reservation request for a unit with the admin's decision. */
async function closeReservationRequest(
  unitId: string,
  userId: string | null | undefined,
  status: "APPROVED" | "REJECTED" | "EXPIRED",
  comment?: string | null,
  decidedById?: string | null,
) {
  if (!userId) return;
  await prisma
    .$executeRawUnsafe(
      `UPDATE "SpaceReservation" SET "status" = $3, "adminComment" = $4, "decidedById" = $5, "decidedAt" = NOW()
        WHERE "unitId" = $1 AND "userId" = $2 AND "status" = 'PENDING'`,
      unitId,
      userId,
      status,
      comment?.trim() || null,
      decidedById ?? null,
    )
    .catch((e) => console.error("[reservation] close request failed:", e));
}

export type PermitUpload = { url: string; name: string; type: string; size: number; key?: string };

const PERMIT_KEY_RE = /^cloudinary:(raw|image):business-permits\/[\w\-./]+$|^local:business-permits\/[\w\-.]+$/;

/**
 * Admin only: a short-lived link to a reservation's business permit.
 * Cloudinary blocks public PDF delivery, and permits are personal documents,
 * so the browser gets a signed download link that expires in 5 minutes.
 */
export async function getPermitLinkAction(adminUserId: string | undefined, unitId: string) {
  try {
    if (!adminUserId) return { success: false as const, error: "Admin access required" };
    const admin = await prisma.user.findUnique({ where: { id: adminUserId }, select: { role: true } });
    if (admin?.role !== "ADMIN") return { success: false as const, error: "Admin access required" };

    const rows = await prisma.$queryRawUnsafe<{ permitUrl: string | null; permitKey: string | null }[]>(
      `SELECT "permitUrl","permitKey" FROM "SpaceReservation" WHERE "unitId" = $1 AND "permitUrl" IS NOT NULL
        ORDER BY ("status" = 'PENDING') DESC, "createdAt" DESC LIMIT 1`,
      unitId,
    );
    const row = rows[0];
    if (!row?.permitUrl) return { success: false as const, error: "No business permit on file." };

    const key = row.permitKey || "";
    if (!key.startsWith("cloudinary:")) return { success: true as const, url: row.permitUrl };

    const [, resourceType, ...rest] = key.split(":");
    const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;
    if (!cloud || !apiKey || !secret) return { success: true as const, url: row.permitUrl };

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
    const url =
      `https://api.cloudinary.com/v1_1/${cloud}/${resourceType}/download?` +
      new URLSearchParams({ ...params, api_key: apiKey, signature }).toString();
    return { success: true as const, url };
  } catch (error) {
    console.error("[reservation] permit link failed:", error);
    return { success: false as const, error: "Couldn't open the business permit." };
  }
}

export async function getAreaSlots() {
  try {
    const slots = await prisma.areaSlot.findMany({
      orderBy: { unit_id: "asc" },
    });
    return { success: true, data: slots };
  } catch (error) {
    console.error("Error fetching area slots:", error);
    return { success: false, error: "Failed to fetch slots" };
  }
}

export async function getAreaSlotByUnitId(unit_id: string) {
  try {
    const slot = await prisma.areaSlot.findUnique({
      where: { unit_id },
    });
    return { success: true, data: slot };
  } catch (error) {
    console.error("Error fetching slot by unit ID:", error);
    return { success: false, error: "Failed to fetch slot" };
  }
}

export async function upsertAreaSlot(data: {
  id?: string;
  unit_id: string;
  status: "AVAILABLE" | "OCCUPIED" | "MAINTENANCE" | "RESERVED";
  sqm_size: number;
  base_rent: number;
  space_images: string[];
  features?: string[];
  floor?: string;
  category?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}) {
  try {
    if (data.id) {
      await (prisma.areaSlot.update as any)({
        where: { id: data.id },
        data: {
          unit_id: data.unit_id,
          status: data.status,
          sqm_size: data.sqm_size,
          base_rent: data.base_rent,
          space_images: data.space_images,
          ...(data.features !== undefined && { features: data.features }),
          ...(data.floor !== undefined && { floor: data.floor }),
          ...(data.category !== undefined && { category: data.category }),
          ...(data.x !== undefined && { x: data.x }),
          ...(data.y !== undefined && { y: data.y }),
          ...(data.width !== undefined && { width: data.width }),
          ...(data.height !== undefined && { height: data.height }),
        },
      });
    } else {
      await (prisma.areaSlot.create as any)({
        data: {
          unit_id: data.unit_id,
          status: data.status,
          sqm_size: data.sqm_size,
          base_rent: data.base_rent,
          space_images: data.space_images,
          features: data.features || [],
          floor: data.floor || "ground",
          category: data.category || "retail",
          x: data.x || 0,
          y: data.y || 0,
          width: data.width || 120,
          height: data.height || 80,
        },
      });
    }
    revalidatePath("/admindashboard/space-manager");
    revalidatePath("/");
    revalidatePath("/available-spaces");
    return { success: true };
  } catch (error: any) {
    console.error("Error upserting area slot:", error);
    if (error?.code === "P2002") {
      return { success: false, error: `Unit ID "${data.unit_id}" is already used by another space.` };
    }
    return { success: false, error: "Failed to save slot" };
  }
}

/** Slots for public pages: same data, but rent stays private (quoted by the leasing team). */
export async function getPublicAreaSlots() {
  const res = await getAreaSlots();
  if (!res.success || !res.data) return res;
  return { success: true, data: res.data.map((s) => ({ ...s, base_rent: 0 })) };
}

export async function getAvailableSlots() {
  try {
    const slots = await prisma.areaSlot.findMany({
      where: { status: "AVAILABLE" },
      orderBy: { unit_id: "asc" },
    });
    return { success: true, data: slots };
  } catch (error) {
    console.error("Error fetching available slots:", error);
    return { success: false, error: "Failed to fetch available slots" };
  }
}

export async function occupySlot(unit_id: string) {
  try {
    await prisma.areaSlot.update({
      where: { unit_id },
      data: { status: "OCCUPIED" },
    });
    revalidatePath("/admindashboard/space-manager");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error occupying slot:", error);
    return { success: false, error: "Failed to occupy slot" };
  }
}

export async function reserveSlotAction(
  unit_id: string,
  userId: string,
  userName: string,
  permit?: PermitUpload,
) {
  try {
    // The business permit is required (the admin checks it before approving).
    const permitOk =
      !!permit &&
      typeof permit.url === "string" &&
      (/^https:\/\//i.test(permit.url) || permit.url.startsWith("/uploads/")) &&
      PERMIT_TYPES.includes(permit.type) &&
      Number(permit.size) > 0 &&
      Number(permit.size) <= PERMIT_MAX_BYTES &&
      (!permit.key || PERMIT_KEY_RE.test(permit.key));
    if (!permitOk) {
      return { success: false, error: "Please upload your business permit (PDF, JPG or PNG, up to 10 MB)." };
    }

    // Who is reserving (from the database, not the caller-supplied name)
    const reserver = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, isBlacklisted: true },
    });
    if (!reserver) return { success: false, error: "Please log in again to reserve a unit." };
    if (reserver.isBlacklisted) {
      return { success: false, error: "Your account is restricted. Please contact mall administration." };
    }
    userName = reserver.name || reserver.email.split("@")[0] || userName;

    // One active reservation per customer (within the hold window)
    const holdCutoff = new Date(Date.now() - RESERVATION_HOLD_MS);
    const existing = await prisma.areaSlot.findFirst({
      where: { tenant_id: userId, status: "RESERVED", updatedAt: { gt: holdCutoff } },
      select: { unit_id: true },
    });
    if (existing) {
      return {
        success: false,
        error:
          existing.unit_id === unit_id
            ? `You already reserved Unit ${unit_id}. The leasing team will contact you.`
            : `You already have an active reservation for Unit ${existing.unit_id}. Wait for it to be approved or released before reserving another unit.`,
      };
    }

    // 1. Claim the unit atomically: only succeeds while it is still AVAILABLE,
    // so two people clicking at the same time can't both reserve it.
    const claimed = await prisma.areaSlot.updateMany({
      where: { unit_id, status: "AVAILABLE" },
      data: {
        status: "RESERVED",
        tenant_id: userId, // Store the reserving user's ID
      },
    });
    if (claimed.count === 0) {
      const current = await prisma.areaSlot.findUnique({ where: { unit_id }, select: { status: true } });
      return {
        success: false,
        code: "UNAVAILABLE" as const,
        status: current?.status ?? null,
        error: current
          ? `Unit ${unit_id} was just ${current.status === "RESERVED" ? "reserved by someone else" : "taken"}. Please choose another unit.`
          : `Unit ${unit_id} no longer exists.`,
      };
    }

    // Keep the request + business permit for the admin's review.
    await prisma.$executeRawUnsafe(
      `INSERT INTO "SpaceReservation" ("id","unitId","userId","permitUrl","permitName","permitType","permitSize","permitKey","status","createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, 'PENDING', NOW())`,
      unit_id,
      userId,
      permit!.url,
      String(permit!.name || "business-permit").slice(0, 200),
      permit!.type,
      Math.round(Number(permit!.size)),
      permit!.key || null,
    );

    // 2+3. Notify admins through notify() (preferences + channels honoured)
    await notify("SPACE_RESERVATION", {
      roles: ["ADMIN"],
      title: "New Space Reservation",
      message: `User ${userName} placed a reservation request for Unit ${unit_id} and submitted a business permit for review. The unit status is now RESERVED.`,
      link: "/admindashboard/bookings?tab=reservation",
    });

    // Bell notice for the person who reserved (the email below is the bespoke one).
    await notify("RESERVATION_UPDATE", {
      recipients: [userId],
      title: `Reservation in process · Unit ${unit_id}`,
      message: `Your business permit was submitted. Unit ${unit_id} is held for you while the admin reviews your documents (up to ${RESERVATION_HOLD_LABEL}).`,
      link: "/available-spaces",
      email: false,
    });

    // 4. Notify User via Gmail
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (user && user.email) {
      try {
        const { sendGmail } = await import("@/lib/gmail");
        await sendGmail({
          to: user.email,
          subject: `Confirmation: Your Reservation for Unit ${unit_id}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #be1e2d;">Space Interest Registered</h2>
              <p>Hello ${user.name || "Valued Merchant"},</p>
              <p>Thank you for your interest in SR Mall. We have successfully registered your reservation request for <strong>Unit ${unit_id}</strong>.</p>
              <hr />
              <p><strong>Status: In process.</strong> Your business permit was submitted and the admin is reviewing your documents. This usually takes up to ${RESERVATION_HOLD_LABEL}. You'll get an email and a notification with the decision.</p>
              <p>You can monitor your communications via the mall messenger.</p>
              <a href="${emailBaseUrl()}/?recipient=admin" style="display: inline-block; padding: 10px 20px; background-color: #be1e2d; color: white; text-decoration: none; border-radius: 5px;">Open Messenger</a>
            </div>
          `,
        });
      } catch (err) {
        console.error("Failed to send User Gmail notification for space reservation:", err);
      }
    }

    revalidatePath("/admindashboard/space-manager");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error reserving slot:", error);
    return { success: false, error: "Failed to place reservation" };
  }
}

export async function approveReservationAction(unit_id: string, comment?: string, adminUserId?: string) {
  try {
    // 1. Fetch current slot to find the reserving user
    const slot = await prisma.areaSlot.findUnique({
      where: { unit_id },
      select: { tenant_id: true }
    });

    // 2. RESERVED → OCCUPIED, only if it is still reserved (not expired / already handled)
    const approved = await prisma.areaSlot.updateMany({
      where: { unit_id, status: "RESERVED" },
      data: { status: "OCCUPIED" },
    });
    if (approved.count === 0) {
      return { success: false, error: `Unit ${unit_id} is no longer reserved. It may have expired or been handled already.` };
    }
    const note = (comment || "").trim().slice(0, 1000);
    await closeReservationRequest(unit_id, slot?.tenant_id, "APPROVED", note, adminUserId);

    // 3. Notify User
    if (slot?.tenant_id) {
      await notify("RESERVATION_UPDATE", {
        recipients: [slot.tenant_id],
        title: `Reservation approved ✅ · Unit ${unit_id}`,
        message: note
          ? `Your reservation for Unit ${unit_id} was approved. Admin note: ${note}`
          : `Your reservation for Unit ${unit_id} was approved. The leasing team will contact you within 24 hours to arrange a site visit.`,
        link: "/available-spaces",
        email: false,
      });

      const user = await prisma.user.findUnique({
        where: { id: slot.tenant_id },
        select: { email: true, name: true }
      });

      if (user && user.email) {
        try {
          const { sendGmail } = await import("@/lib/gmail");
          await sendGmail({
            to: user.email,
            subject: `Hooray! Your Reservation for Unit ${unit_id} is Approved!`,
            html: `
              <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #10b981;">Reservation Approved</h2>
                <p>Hello ${user.name || "Valued Merchant"},</p>
                <p>We are pleased to inform you that your strategic reservation for <strong>Unit ${unit_id}</strong> has been <strong>APPROVED</strong> by the mall administration.</p>
                ${note ? `<div style="background: #ecfdf5; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #10b981;"><strong>Admin Note:</strong> ${escapeHtml(note)}</div>` : ""}
                <hr />
                <p>Next Steps: Our leasing representative will reach out to you within 24 hours to schedule a site visit and begin the contract initialization process.</p>
                <p>You can now view more details about the mall's merchant guidelines in your dashboard.</p>
                <a href="${emailBaseUrl()}/" style="display: inline-block; padding: 10px 20px; background-color: #10b981; color: white; text-decoration: none; border-radius: 5px;">Return to Portal</a>
              </div>
            `,
          });
        } catch (err) {
          console.error("Failed to send space approval email:", err);
        }
      }
    }

    revalidatePath("/admindashboard/space-manager");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error approving reservation:", error);
    return { success: false, error: "Failed to approve reservation" };
  }
}

export async function rejectReservationAction(unit_id: string, feedback?: string, adminUserId?: string) {
  try {
    // The applicant always gets a reason.
    feedback = (feedback || "").trim().slice(0, 1000);
    if (!feedback) return { success: false, error: "Please write a comment so the applicant knows why." };

    // 1. Fetch current slot to find the reserving user
    const slot = await prisma.areaSlot.findUnique({
      where: { unit_id },
      select: { tenant_id: true, floor: true, category: true, updatedAt: true }
    });

    // 2. RESERVED → AVAILABLE, only if it is still reserved
    const released = await prisma.areaSlot.updateMany({
      where: { unit_id, status: "RESERVED" },
      data: {
        status: "AVAILABLE",
        tenant_id: null,
      },
    });
    if (released.count === 0) {
      return { success: false, error: `Unit ${unit_id} is no longer reserved. It may have expired or been handled already.` };
    }

    await closeReservationRequest(unit_id, slot?.tenant_id, "REJECTED", feedback, adminUserId);

    // Keep a record in User Manager → Tenant History.
    if (slot?.tenant_id) {
      const { recordRejectedReservation } = await import("@/lib/tenant-history");
      await recordRejectedReservation({
        userId: slot.tenant_id,
        unitId: unit_id,
        floor: slot.floor,
        category: slot.category,
        reservedAt: slot.updatedAt,
        feedback,
        endedById: adminUserId,
      });
    }

    // 3. Notify User
    if (slot?.tenant_id) {
      await notify("RESERVATION_UPDATE", {
        recipients: [slot.tenant_id],
        title: `Reservation declined · Unit ${unit_id}`,
        message: feedback?.trim()
          ? `Your reservation for Unit ${unit_id} was declined. Admin note: ${feedback.trim()}`
          : `Your reservation for Unit ${unit_id} was declined and the unit is available again. Feel free to reserve another space.`,
        link: "/available-spaces",
        email: false,
      });

      const user = await prisma.user.findUnique({
        where: { id: slot.tenant_id },
        select: { email: true, name: true }
      });

      if (user && user.email) {
        try {
          const { sendGmail } = await import("@/lib/gmail");
          await sendGmail({
            to: user.email,
            subject: `Update on your SR Mall Reservation: Unit ${unit_id}`,
            html: `
              <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #be1e2d;">Reservation Released</h2>
                <p>Hello ${user.name || "Valued Merchant"},</p>
                <p>Regarding your reservation for <strong>Unit ${unit_id}</strong>, we wish to inform you that the reservation has been released and the unit is now available for other applicants.</p>
                ${feedback ? `<div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #be1e2d;"><strong>Admin Note:</strong> ${escapeHtml(feedback)}</div>` : ""}
                <hr />
                <p>If you have questions or wish to explore other units, please feel free to browse our available spaces or contact us via messenger.</p>
                <a href="${emailBaseUrl()}/" style="display: inline-block; padding: 10px 20px; background-color: #334155; color: white; text-decoration: none; border-radius: 5px;">Browse Other Spaces</a>
              </div>
            `,
          });
        } catch (err) {
          console.error("Failed to send space rejection email:", err);
        }
      }
    }

    revalidatePath("/admindashboard/space-manager");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error rejecting reservation:", error);
    return { success: false, error: "Failed to reject reservation" };
  }
}

export async function deleteAreaSlot(id: string) {
  try {
    // A space someone is in (or has on hold) can't be deleted out from under them.
    const slot = await prisma.areaSlot.findUnique({ where: { id }, select: { status: true, unit_id: true } });
    if (!slot) return { success: false, error: "This space no longer exists." };
    if (slot.status === "OCCUPIED" || slot.status === "RESERVED") {
      return {
        success: false,
        error: `Unit ${slot.unit_id} is ${slot.status.toLowerCase()}. ${
          slot.status === "RESERVED" ? "Approve or release the reservation" : "Move the tenant out"
        } before deleting it.`,
      };
    }
    await prisma.areaSlot.delete({ where: { id } });
    revalidatePath("/admindashboard/space-manager");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error deleting area slot:", error);
    return { success: false, error: "Failed to delete slot" };
  }
}

/**
 * Scans reserved commercial space slots.
 * Automatically rejects reservations unreviewed after the hold window (2 days).
 * Sends an urgent pre-deadline reminder email to admin if <= 6 hours remaining.
 */
export async function processExpiredReservationsAction() {
  try {
    const reservedSlots = await prisma.areaSlot.findMany({
      where: { status: "RESERVED" },
    });

    const now = Date.now();
    const twentyFourHoursMs = RESERVATION_HOLD_MS; // hold window (name kept from the 24h version)
    const eighteenHoursMs = RESERVATION_HOLD_MS - RESERVATION_URGENT_MS;

    for (const slot of reservedSlots) {
      const reservationTime = new Date(slot.updatedAt).getTime();
      const ageMs = now - reservationTime;

      // 1. Check if expired (past the hold window) -> Auto-Reject
      if (ageMs >= twentyFourHoursMs) {
        await prisma.areaSlot.update({
          where: { unit_id: slot.unit_id },
          data: { status: "AVAILABLE", tenant_id: null },
        });
        await closeReservationRequest(slot.unit_id, slot.tenant_id, "EXPIRED", "Not reviewed within the review window.");

        // 🚨 Notify the reserver — in-app + email, gated by their own prefs
        if (slot.tenant_id) {
          await notify("SPACE_RESERVATION", {
            recipients: [slot.tenant_id],
            title: "Reservation Automatically Released",
            message: `Your reservation for Unit ${slot.unit_id} was automatically released after ${RESERVATION_HOLD_LABEL} without a decision. The unit is back in the available pool — submit a new reservation anytime or speak to the leasing desk.`,
            link: "/available-spaces",
          });
        }

        // Notify admins of the auto-rejection
        await notify("SPACE_RESERVATION", {
          roles: ["ADMIN"],
          title: `Reservation Auto-Rejected (${RESERVATION_HOLD_LABEL} Window)`,
          message: `Reservation for Unit ${slot.unit_id} was automatically rejected and returned to available inventory because it wasn't reviewed within ${RESERVATION_HOLD_LABEL}.`,
          link: "/admindashboard/bookings?tab=reservation",
        });
      }
      // 2. Check if approaching deadline (between 18h and 24h old, <= 6 hours left) -> Send Urgent Reminder Email
      else if (ageMs >= eighteenHoursMs && ageMs < twentyFourHoursMs) {
        const hoursLeft = Math.max(1, Math.round((twentyFourHoursMs - ageMs) / (1000 * 60 * 60)));

        // Skip if we already warned about this reservation session
        const existingReminder = await prisma.notification.findFirst({
          where: {
            type: "RESERVATION_EXPIRING",
            message: { contains: slot.unit_id },
            createdAt: { gte: new Date(reservationTime) },
          },
        });

        if (!existingReminder) {
          const unitLabel = `Unit ${slot.unit_id}`;
          const window = `${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}`;

          // Admins: review before the window closes
          await notify("RESERVATION_EXPIRING", {
            roles: ["ADMIN"],
            title: `⚠️ URGENT: ${unitLabel} Reservation Expiring`,
            message: `Space reservation for ${unitLabel} will be automatically rejected in ${window} if no action is taken.`,
            link: "/admindashboard/bookings?tab=reservation",
            dedupeHours: 48,
          });

          // The reserving customer: act now or lose the unit
          if (slot.tenant_id) {
            await notify("RESERVATION_EXPIRING", {
              recipients: [slot.tenant_id],
              title: `⚠️ Your ${unitLabel} Reservation Is Expiring`,
              message: `Your reservation for ${unitLabel} expires in ${window} unless it is confirmed. After that it returns to the available pool.`,
              link: "/available-spaces",
              dedupeHours: 48,
            });
          }
        }
      }
    }

    // No revalidatePath here: every page that shows reservations is a client
    // component that fetches its own data.
    return { success: true };
  } catch (error) {
    console.error("Error processing expired reservations:", error);
    return { success: false, error: "Failed to process reservations" };
  }
}

/**
 * Fetches all currently reserved space slots with reserving user profile details
 * and computed countdown metrics.
 */
export async function getReservedSlotsWithDetailsAction() {
  try {
    // 1. Expiry sweeps run in the background after this response (throttled),
    // so the admin never waits on auto-reject writes and emails.
    const { scheduleSweeps } = await import("@/lib/sweeps");
    scheduleSweeps();

    // 2. Query remaining active RESERVED slots. Ones already past the hold
    // window are hidden here; the background sweep releases them.
    const slots = await prisma.areaSlot.findMany({
      where: {
        status: "RESERVED",
        updatedAt: { gt: new Date(Date.now() - RESERVATION_HOLD_MS) },
      },
      orderBy: { updatedAt: "asc" },
    });

    // Business permit of each open request (latest per unit + person).
    const requests = slots.length
      ? await prisma
          .$queryRawUnsafe<
            { unitId: string; userId: string; permitUrl: string | null; permitName: string | null; permitType: string | null; permitSize: number | null; createdAt: Date }[]
          >(
            `SELECT DISTINCT ON ("unitId", "userId") "unitId","userId","permitUrl","permitName","permitType","permitSize","createdAt"
               FROM "SpaceReservation" WHERE "status" = 'PENDING' AND "unitId" = ANY($1::text[])
              ORDER BY "unitId", "userId", "createdAt" DESC`,
            slots.map((s) => s.unit_id),
          )
          .catch(() => [])
      : [];
    const requestOf = new Map(requests.map((r) => [`${r.unitId}::${r.userId}`, r]));

    const userIds = slots.map((s) => s.tenant_id).filter(Boolean) as string[];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const now = Date.now();
    const twentyFourHoursMs = RESERVATION_HOLD_MS; // hold window

    const detailedSlots = slots.map((slot) => {
      const req = slot.tenant_id ? requestOf.get(`${slot.unit_id}::${slot.tenant_id}`) : undefined;
      const reservedAt = new Date(slot.updatedAt);
      const elapsedMs = now - reservedAt.getTime();
      const remainingMs = Math.max(0, twentyFourHoursMs - elapsedMs);
      const hoursRemaining = Math.floor(remainingMs / (1000 * 60 * 60));
      const minutesRemaining = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

      return {
        ...slot,
        reservingUser: slot.tenant_id ? userMap.get(slot.tenant_id) || null : null,
        reservedAt: reservedAt.toISOString(),
        hoursRemaining,
        minutesRemaining,
        remainingFormatted:
          hoursRemaining >= 24
            ? `${Math.floor(hoursRemaining / 24)}d ${hoursRemaining % 24}h`
            : `${hoursRemaining}h ${minutesRemaining}m`,
        isUrgent: remainingMs < RESERVATION_URGENT_MS,
        isWarning: remainingMs >= RESERVATION_URGENT_MS && remainingMs < RESERVATION_WARNING_MS,
        permit: req?.permitUrl
          ? {
              url: req.permitUrl,
              name: req.permitName || "business-permit",
              type: req.permitType || "",
              size: Number(req.permitSize || 0),
              uploadedAt: new Date(req.createdAt).toISOString(),
            }
          : null,
      };
    });

    return { success: true, data: detailedSlots };
  } catch (error) {
    console.error("Error fetching detailed reserved slots:", error);
    return { success: false, error: "Failed to fetch reserved slots" };
  }
}
