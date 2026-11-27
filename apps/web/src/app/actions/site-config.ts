"use server";

import { prisma } from "@srmall/database";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth-server";

export async function getSiteConfig() {
  try {
    let config = await prisma.siteConfig.findUnique({
      where: { id: "singleton" },
    });

    if (!config) {
      config = await prisma.siteConfig.create({
        data: {
          id: "singleton",
          heroTitle: "Shops and spaces at SR Mall.",
          heroSubtitle:
            "Shops, dining and spaces for rent at SR Mall.",
          heroBadge: "SR Mall",
          heroBgUrl:
            "https://images.unsplash.com/photo-1519642918688-7e43b19245d8?auto=format&fit=crop&q=80&w=2000",
          heroOverlayDark: 40,
          primaryBtnText: "Explore Now",
          isMaintenance: false,
          defaultAdTitle: "Welcome to SR Mall",
          defaultAdDesc:
            "Find shops, products and spaces for rent.",
          defaultAdImage:
            "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=2000",
          defaultAdCta: "View Directory",
        },
      });
    }

    return config;
  } catch (error) {
    console.error("Failed to fetch site config:", error);
    return null;
  }
}

export async function updateSiteConfig(data: {
  heroTitle?: string;
  heroSubtitle?: string;
  heroBadge?: string;
  heroBgUrl?: string;
  heroOverlayDark?: number;
  primaryBtnText?: string;
  isMaintenance?: boolean;
  defaultAdTitle?: string;
  defaultAdDesc?: string;
  defaultAdImage?: string;
  defaultAdCta?: string;
}) {
  try {
    // Changes the public site (including maintenance mode): CMS staff only.
    await requireStaff("cms");
    const current = await prisma.siteConfig.findUnique({
      where: { id: "singleton" },
      select: { isMaintenance: true },
    });

    const config = await prisma.siteConfig.upsert({
      where: { id: "singleton" },
      update: data,
      create: {
        id: "singleton",
        heroTitle: data.heroTitle || "Shops and spaces at SR Mall.",
        heroSubtitle: data.heroSubtitle || "Description...",
        ...data,
      },
    });

    // 🛡️ Public storefront went offline (or came back) → tell everyone.
    if (
      typeof data.isMaintenance === "boolean" &&
      current &&
      current.isMaintenance !== data.isMaintenance
    ) {
      const { notify } = await import("@/lib/notify");
      await notify("MAINTENANCE_MODE", {
        roles: ["ADMIN", "TENANT"],
        title: data.isMaintenance
          ? "Maintenance Mode Enabled"
          : "Maintenance Mode Disabled",
        message: data.isMaintenance
          ? "The public storefront has been taken offline for maintenance. Customers can no longer browse until it is re-enabled."
          : "The public storefront is back online and customers can browse again.",
        link: "/",
      });
    }

    revalidatePath("/");
    revalidatePath("/admindashboard/site-editor");
    return { success: true, config };
  } catch (error) {
    console.error("Failed to update site config:", error);
    return { success: false };
  }
}
