"use server";

import { prisma } from "@srmall/database";
import { revalidatePath } from "next/cache";
import { destroyFile } from "@/lib/upload-server";
import { requireStaff } from "@/lib/auth-server";
import { cleanAbout, readAbout, unnamedItem, type AboutPageContent } from "@/lib/about";

/*
 * Server actions can be called by anyone who knows how, whatever page they
 * are on, so the dashboard redirect does not protect them. Every action here
 * that changes the public site checks for a signed-in staff account with the
 * Public-View CMS permission. The public reads stay open.
 */

// Public View Config Actions
export async function getPublicViewConfigAction() {
  try {
    const config = await prisma.publicViewConfig.findFirst({
      orderBy: { createdAt: "desc" },
    });
    if (!config) return null;
    // This record is served to the public site: never ship the (unused)
    // payment gateway credentials with it. The About Us content is left out too,
    // so hidden sections stay hidden (the page reads it on the server).
    const { paymentGatewayApiKey, paymentGatewayProvider, aboutPage, ...publicConfig } = config;
    // Newer column (raw SQL until the Prisma client is regenerated)
    const extra = await prisma
      .$queryRawUnsafe<{ footerOpeningHours: string | null }[]>(
        `SELECT "footerOpeningHours" FROM "PublicViewConfig" WHERE "id" = $1`,
        config.id,
      )
      .catch(() => []);
    return { ...publicConfig, footerOpeningHours: extra[0]?.footerOpeningHours ?? null };
  } catch (error) {
    console.error("Error fetching public view config:", error);
    return null;
  }
}

/** Website Content editor: the About Us content, hidden sections included. */
export async function getAboutPageAction() {
  try {
    await requireStaff("cms");
    const config = await prisma.publicViewConfig.findFirst({
      orderBy: { createdAt: "desc" },
      select: { aboutPage: true },
    });
    return { success: true as const, data: readAbout(config?.aboutPage) };
  } catch (error) {
    console.error("Error fetching the About Us content:", error);
    return { success: false as const, error: "Couldn't load the About Us content." };
  }
}

export async function updatePublicViewConfigAction(
  data: {
    logoUrl?: string | null;
    companyName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    contactAddress?: string | null;
    heroTitle?: string | null;
    heroSubtitle?: string | null;
    heroBgUrl?: string | null;
    heroBadge?: string | null;
    heroOverlayDark?: number;
    featuredVideoUrl?: string | null;
    videoTitle?: string | null;
    videoDescription?: string | null;
    productsTitle?: string | null;
    productsDescription?: string | null;
    videoCtaLabel?: string | null;
    directoryTitle?: string | null;
    directoryDescription?: string | null;
    spacesTitle?: string | null;
    spacesDescription?: string | null;
    venueEyebrow?: string | null;
    venueTitle?: string | null;
    venueDescription?: string | null;
    venueImageUrl?: string | null;
    venueImageAlt?: string | null;
    reviewsTitle?: string | null;
    reviewsDescription?: string | null;
    locationTitle?: string | null;
    aboutTitle?: string | null;
    aboutDescription?: string | null;
    aboutImageUrl?: string | null;
    contactTitle?: string | null;
    contactDescription?: string | null;
    themeColor?: string | null;
    googleMapsEmbedUrl?: string | null;
    googleMapsApiKey?: string | null;
    paymentGatewayProvider?: string | null;
    paymentGatewayApiKey?: string | null;
    footerDescription?: string | null;
    footerInstagram?: string | null;
    footerFacebook?: string | null;
    footerWebsite?: string | null;
    footerCopyrightText?: string | null;
    footerAddress?: string | null;
    footerPhone?: string | null;
    footerEmail?: string | null;
    footerOpeningHours?: string | null;
    /** Left out: the saved About Us content stays as it is. */
    aboutPage?: AboutPageContent | null;
  },
  adminId?: string,
) {
  await requireStaff("cms");
  try {
    // Same record the getter returns (newest), so a save always lands where it is read.
    const existingConfig = await prisma.publicViewConfig.findFirst({
      orderBy: { createdAt: "desc" },
    });
    const {
      id,
      createdAt,
      updatedAt,
      paymentGatewayApiKey,
      paymentGatewayProvider,
      footerOpeningHours,
      aboutPage,
      ...updateData
    } = data as any;
    if (aboutPage) {
      const content = cleanAbout(aboutPage);
      if (unnamedItem(content)) throw new Error("Every service and feature needs a name.");
      updateData.aboutPage = content;
    }
    const saveOpeningHours = (configId: string) =>
      footerOpeningHours === undefined
        ? Promise.resolve()
        : prisma.$executeRawUnsafe(
            `UPDATE "PublicViewConfig" SET "footerOpeningHours" = $2 WHERE "id" = $1`,
            configId,
            String(footerOpeningHours || "").trim().slice(0, 200) || null,
          );

    if (existingConfig) {
      const updatedConfig = await prisma.publicViewConfig.update({
        where: { id: existingConfig.id },
        data: {
          ...updateData,
          updatedAt: new Date(),
        },
      });
      await saveOpeningHours(updatedConfig.id);
      revalidatePath("/admindashboard/public-view-cms");
      revalidatePath("/");
      revalidatePath("/about");
      return updatedConfig;
    } else {
      const newConfig = await prisma.publicViewConfig.create({
        data: updateData,
      });
      await saveOpeningHours(newConfig.id);
      revalidatePath("/admindashboard/public-view-cms");
      revalidatePath("/");
      revalidatePath("/about");
      return newConfig;
    }
  } catch (error) {
    console.error("Error updating public view config:", error);
    throw new Error("Failed to update public view config");
  }
}

// Carousel Actions
export async function getPublicViewCarouselAction() {
  try {
    const carouselItems = await prisma.publicViewCarousel.findMany({
      where: { isActive: true },
      orderBy: { priority: "desc" },
    });
    return carouselItems;
  } catch (error) {
    console.error("Error fetching carousel items:", error);
    return [];
  }
}

export async function getAllCarouselItemsAction() {
  try {
    await requireStaff("cms");
    const carouselItems = await prisma.publicViewCarousel.findMany({
      orderBy: { priority: "desc" },
    });
    return carouselItems;
  } catch (error) {
    console.error("Error fetching all carousel items:", error);
    return [];
  }
}

export async function createCarouselItemAction(
  data: {
    title: string;
    description: string;
    imageUrl: string;
    linkUrl?: string;
    isActive?: boolean;
    priority?: number;
    startDate?: Date;
    endDate?: Date;
    storageKey?: string;
  },
  adminId?: string,
) {
  await requireStaff("cms");
  try {
    const carouselItem = await prisma.publicViewCarousel.create({
      data: data,
    });
    revalidatePath("/admindashboard/public-view-cms");
    revalidatePath("/");
    return carouselItem;
  } catch (error) {
    console.error("Error creating carousel item:", error);
    throw new Error("Failed to create carousel item");
  }
}

export async function updateCarouselItemAction(
  id: string,
  data: {
    title?: string;
    description?: string;
    imageUrl?: string;
    linkUrl?: string;
    isActive?: boolean;
    priority?: number;
    startDate?: Date;
    endDate?: Date;
    storageKey?: string;
  },
) {
  await requireStaff("cms");
  try {
    const updatedItem = await prisma.publicViewCarousel.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
    revalidatePath("/admindashboard/public-view-cms");
    revalidatePath("/");
    return updatedItem;
  } catch (error) {
    console.error("Error updating carousel item:", error);
    throw new Error("Failed to update carousel item");
  }
}

export async function deleteCarouselItemAction(id: string) {
  await requireStaff("cms");
  try {
    const item = await prisma.publicViewCarousel.findUnique({ where: { id } });
    if (item?.storageKey) {
      await destroyFile(item.storageKey);
    }

    await prisma.publicViewCarousel.delete({
      where: { id },
    });
    revalidatePath("/admindashboard/public-view-cms");
    revalidatePath("/");
    return true;
  } catch (error) {
    console.error("Error deleting carousel item:", error);
    throw new Error("Failed to delete carousel item");
  }
}

export async function toggleCarouselItemAction(id: string) {
  await requireStaff("cms");
  try {
    const item = await prisma.publicViewCarousel.findUnique({
      where: { id },
    });

    if (!item) {
      throw new Error("Carousel item not found");
    }

    const updatedItem = await prisma.publicViewCarousel.update({
      where: { id },
      data: {
        isActive: !item.isActive,
        updatedAt: new Date(),
      },
    });

    revalidatePath("/admindashboard/public-view-cms");
    revalidatePath("/");
    return updatedItem;
  } catch (error) {
    console.error("Error toggling carousel item:", error);
    throw new Error("Failed to toggle carousel item");
  }
}
