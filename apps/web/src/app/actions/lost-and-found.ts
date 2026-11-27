"use server";

import { actingUserId } from "@/lib/auth-server";
import { holds, requireAccount, requireStaffAny } from "@/lib/action-guard";
import { prisma } from "@srmall/database";
import { revalidatePath } from "next/cache";

export async function createLostAndFoundItem(data: {
  type: "LOST" | "FOUND";
  title: string;
  description?: string;
  location: string;
  date: string; // ISO date string
  time?: string;
  userId?: string;
  imageUrl?: string;
}) {
  try {
    const account = await requireAccount();
    // Only the CMS may file a report under someone else's name (or none).
    if (!holds(account, "cms")) data = { ...data, userId: actingUserId(account) };
    const item = await prisma.lostAndFoundItem.create({
      data: {
        type: data.type,
        title: data.title,
        description: data.description || "",
        location: data.location,
        date: new Date(data.date),
        time: data.time || "",
        userId: data.userId || null,
        imageUrl: data.imageUrl || null,
        status: "PENDING",
      },
    });

    revalidatePath("/lost-and-found");
    revalidatePath("/admindashboard/public-view-cms");

    // A shopper's report → admins (admin-created posts don't need an alert).
    if (data.userId) {
      const reporter = await prisma.user.findUnique({ where: { id: data.userId }, select: { name: true, role: true } });
      if (reporter && reporter.role !== "ADMIN") {
        const { notify } = await import("@/lib/notify");
        await notify("LOST_AND_FOUND_REPORT", {
          roles: ["ADMIN"],
          title: `New ${data.type === "LOST" ? "lost" : "found"} item report`,
          message: `${reporter.name || "A shopper"} reported "${data.title}" at ${data.location}.`,
          link: "/admindashboard/public-view-cms",
        });
      }
    }

    return { success: true, data: item };
  } catch (error: any) {
    console.error("Failed to create lost and found item", error);
    return { success: false, error: error.message || "Something went wrong" };
  }
}

export async function getLostAndFoundItems(type?: "LOST" | "FOUND") {
  try {
    const account = await requireAccount();
    const whereClause = type ? { type } : {};
    const items = await prisma.lostAndFoundItem.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    // Reporters' names and emails are for the CMS only.
    return { success: true, data: holds(account, "cms") ? items : items.map((i) => ({ ...i, user: null })) };
  } catch (error: any) {
    console.error("Failed to get lost and found items", error);
    return { success: false, error: error.message || "Something went wrong" };
  }
}

export async function updateLostAndFoundItemStatus(id: string, status: string) {
  try {
    await requireStaffAny("cms");
    const item = await prisma.lostAndFoundItem.update({
      where: { id },
      data: { status },
    });

    // Tell the person who reported it when the item moves on.
    if (item.userId && status !== "PENDING") {
      const done = status === "CLAIMED" || status === "RESOLVED";
      const { notify } = await import("@/lib/notify");
      await notify("LOST_AND_FOUND_UPDATE", {
        recipients: [item.userId],
        title: done ? `Lost & found closed · ${item.title}` : `Lost & found update · ${item.title}`,
        message: done
          ? `"${item.title}" was marked ${status.toLowerCase()} by the mall office.`
          : `"${item.title}" is now ${status.toLowerCase()}. Visit the mall office or message the admin for details.`,
        link: "/lost-and-found",
      });
    }

    revalidatePath("/lost-and-found");
    revalidatePath("/admindashboard/public-view-cms");

    return { success: true, data: item };
  } catch (error: any) {
    console.error("Failed to update lost and found item status", error);
    return { success: false, error: error.message || "Something went wrong" };
  }
}

export async function deleteLostAndFoundItem(id: string) {
  try {
    await requireStaffAny("cms");
    await prisma.lostAndFoundItem.delete({
      where: { id },
    });

    revalidatePath("/lost-and-found");
    revalidatePath("/admindashboard/public-view-cms");

    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete lost and found item", error);
    return { success: false, error: error.message || "Something went wrong" };
  }
}

