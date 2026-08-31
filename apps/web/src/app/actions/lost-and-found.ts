"use server";

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

    return { success: true, data: item };
  } catch (error: any) {
    console.error("Failed to create lost and found item", error);
    return { success: false, error: error.message || "Something went wrong" };
  }
}

export async function getLostAndFoundItems(type?: "LOST" | "FOUND") {
  try {
    const whereClause = type ? { type } : {};
    const items = await prisma.lostAndFoundItem.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    return { success: true, data: items };
  } catch (error: any) {
    console.error("Failed to get lost and found items", error);
    return { success: false, error: error.message || "Something went wrong" };
  }
}

export async function updateLostAndFoundItemStatus(id: string, status: string) {
  try {
    const item = await prisma.lostAndFoundItem.update({
      where: { id },
      data: { status },
    });

    revalidatePath("/lost-and-found");
    revalidatePath("/admindashboard/public-view-cms");

    return { success: true, data: item };
  } catch (error: any) {
    console.error("Failed to update lost and found item status", error);
    return { success: false, error: error.message || "Something went wrong" };
  }
}
