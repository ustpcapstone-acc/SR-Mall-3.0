"use server";

import { prisma } from "@srmall/database";
import { revalidatePath } from "next/cache";

export async function getNotificationsAction(userId: string) {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return { success: true, data: notifications };
  } catch (error) {
    console.error("[GET_NOTIFICATIONS_ERROR]:", error);
    return { success: false, error: "Failed to fetch notifications" };
  }
}

export async function markNotificationAsReadAction(notificationId: string) {
  try {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to mark as read" };
  }
}

export async function markAllNotificationsAsReadAction(userId: string) {
  try {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to mark all as read" };
  }
}

export async function getUnreadMessageCountAction(userId: string) {
  try {
    // Check if the user is an admin - if so, count across ALL admin user IDs
    const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    
    let whereClause: any = { userId, isRead: false, type: "MESSAGE" };
    
    if (currentUser?.role === "ADMIN") {
      // Fetch all admin user IDs and count notifications for any of them
      const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      const adminIds = admins.map((a: any) => a.id);
      whereClause = { userId: { in: adminIds }, isRead: false, type: "MESSAGE" };
    }
    
    const count = await prisma.notification.count({ where: whereClause });
    return { success: true, data: count };
  } catch (error) {
    return { success: false, error: "Failed to fetch count" };
  }
}

export async function markMessageNotificationsAsReadAction(userId: string) {
  try {
    const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    
    let whereClause: any = { userId, isRead: false, type: "MESSAGE" };
    
    if (currentUser?.role === "ADMIN") {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      const adminIds = admins.map((a: any) => a.id);
      whereClause = { userId: { in: adminIds }, isRead: false, type: "MESSAGE" };
    }
    
    await prisma.notification.updateMany({ where: whereClause, data: { isRead: true } });
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to mark messages as read" };
  }
}
