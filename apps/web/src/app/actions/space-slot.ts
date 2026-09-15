"use server";

import { prisma } from "@srmall/database";
import { revalidatePath } from "next/cache";

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
    revalidatePath("/public-view");
    revalidatePath("/available-spaces");
    return { success: true };
  } catch (error) {
    console.error("Error upserting area slot:", error);
    return { success: false, error: "Failed to save slot" };
  }
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
    revalidatePath("/public-view");
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
) {
  try {
    // 1. Update Slot Status
    await prisma.areaSlot.update({
      where: { unit_id },
      data: { 
        status: "RESERVED",
        tenant_id: userId // Store the reserving user's ID
      },
    });

    // 2. Identify Admins
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    // 3. Notify Admins
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin: any) => ({
          userId: admin.id,
          type: "SPACE_RESERVATION",
          title: "New Space Reservation",
          message: `User ${userName} has placed a reservation request for Unit ${unit_id}.`,
        })),
      });

      // Send Gmail notification to Admin
      try {
        const { sendGmail } = await import("@/lib/gmail");
        await sendGmail({
          to: process.env.GMAIL_USER || "jerickaradilla76@gmail.com",
          subject: `🚨 NEW SPACE RESERVATION: Unit ${unit_id}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #be1e2d;">New Space Reservation Request</h2>
              <p>A user has registered interest in a commercial space through the public portal.</p>
              <hr />
              <p><strong>Unit ID:</strong> ${unit_id}</p>
              <p><strong>User Name:</strong> ${userName}</p>
              <p><strong>User ID:</strong> ${userId}</p>
              <hr />
              <p>The unit status has been automatically updated to <strong>RESERVED</strong>.</p>
              <p>Please log in to the admin dashboard to process this reservation.</p>
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/admindashboard/space-manager" style="display: inline-block; padding: 10px 20px; background-color: #be1e2d; color: white; text-decoration: none; border-radius: 5px;">Manage Spaces</a>
            </div>
          `,
        });
      } catch (err) {
        console.error("Failed to send Gmail notification for space reservation:", err);
      }
    }

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
              <p>Our leasing team has been notified. We will review your profile and contact you shortly to discuss the next steps in the merchant onboarding process.</p>
              <p>You can monitor your communications via the mall messenger.</p>
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/messenger" style="display: inline-block; padding: 10px 20px; background-color: #be1e2d; color: white; text-decoration: none; border-radius: 5px;">Open Messenger</a>
            </div>
          `,
        });
      } catch (err) {
        console.error("Failed to send User Gmail notification for space reservation:", err);
      }
    }

    revalidatePath("/admindashboard/space-manager");
    revalidatePath("/public-view");
    return { success: true };
  } catch (error) {
    console.error("Error reserving slot:", error);
    return { success: false, error: "Failed to place reservation" };
  }
}

export async function approveReservationAction(unit_id: string) {
  try {
    // 1. Fetch current slot to find the reserving user
    const slot = await prisma.areaSlot.findUnique({
      where: { unit_id },
      select: { tenant_id: true }
    });

    // 2. Update Slot Status to OCCUPIED
    await prisma.areaSlot.update({
      where: { unit_id },
      data: { status: "OCCUPIED" },
    });

    // 3. Notify User
    if (slot?.tenant_id) {
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
                <hr />
                <p>Next Steps: Our leasing representative will reach out to you within 24 hours to schedule a site visit and begin the contract initialization process.</p>
                <p>You can now view more details about the mall's merchant guidelines in your dashboard.</p>
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/public-view" style="display: inline-block; padding: 10px 20px; background-color: #10b981; color: white; text-decoration: none; border-radius: 5px;">Return to Portal</a>
              </div>
            `,
          });
        } catch (err) {
          console.error("Failed to send space approval email:", err);
        }
      }
    }

    revalidatePath("/admindashboard/space-manager");
    revalidatePath("/public-view");
    return { success: true };
  } catch (error) {
    console.error("Error approving reservation:", error);
    return { success: false, error: "Failed to approve reservation" };
  }
}

export async function rejectReservationAction(unit_id: string, feedback?: string) {
  try {
    // 1. Fetch current slot to find the reserving user
    const slot = await prisma.areaSlot.findUnique({
      where: { unit_id },
      select: { tenant_id: true }
    });

    // 2. Revert Slot Status to AVAILABLE
    await prisma.areaSlot.update({
      where: { unit_id },
      data: { 
        status: "AVAILABLE",
        tenant_id: null 
      },
    });

    // 3. Notify User
    if (slot?.tenant_id) {
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
                ${feedback ? `<div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #be1e2d;"><strong>Admin Note:</strong> ${feedback}</div>` : ""}
                <hr />
                <p>If you have questions or wish to explore other units, please feel free to browse our available spaces or contact us via messenger.</p>
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/public-view" style="display: inline-block; padding: 10px 20px; background-color: #334155; color: white; text-decoration: none; border-radius: 5px;">Browse Other Spaces</a>
              </div>
            `,
          });
        } catch (err) {
          console.error("Failed to send space rejection email:", err);
        }
      }
    }

    revalidatePath("/admindashboard/space-manager");
    revalidatePath("/public-view");
    return { success: true };
  } catch (error) {
    console.error("Error rejecting reservation:", error);
    return { success: false, error: "Failed to reject reservation" };
  }
}

export async function deleteAreaSlot(id: string) {
  try {
    await prisma.areaSlot.delete({ where: { id } });
    revalidatePath("/admindashboard/space-manager");
    revalidatePath("/public-view");
    return { success: true };
  } catch (error) {
    console.error("Error deleting area slot:", error);
    return { success: false, error: "Failed to delete slot" };
  }
}
