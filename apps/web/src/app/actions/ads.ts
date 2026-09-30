"use server";

import { prisma } from "@srmall/database";
import { emailBaseUrl } from "@/utils/get-base-url";
import { revalidatePath } from "next/cache";
import { getCloudStorageProvider } from "@/lib/cloud-storage";

const PRIORITY_RANK: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/** Default banner first, then High → Medium → Low, then newest start date. */
function sortAds<T extends { isDefault?: boolean; priority?: string; startDate: Date | string }>(ads: T[]): T[] {
  return [...ads].sort(
    (a, b) =>
      Number(!!b.isDefault) - Number(!!a.isDefault) ||
      (PRIORITY_RANK[a.priority || "MEDIUM"] ?? 1) - (PRIORITY_RANK[b.priority || "MEDIUM"] ?? 1) ||
      new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
  );
}

// ─── CLOUD STORAGE UPLOAD ───────────────────────────────────────────────────────────────────────────────────────────────────

export async function uploadAdImage(
  file: File,
): Promise<{ url: string; key: string }> {
  const storage = getCloudStorageProvider();
  return await storage.uploadFile(file, "ads");
}

export async function deleteAdImage(key: string): Promise<boolean> {
  const storage = getCloudStorageProvider();
  return await storage.deleteFile(key);
}

// ─── ADMIN: MALL-WIDE ADS (HERO CAROUSEL) ───────────────────────────────────

export async function createMallAd(data: {
  title: string;
  description?: string;
  imageUrl: string;
  linkUrl: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  startDate: Date;
  endDate: Date;
  adminId: string;
  storageKey?: string | null;
}) {
  try {
    console.log("[ADS_ACTION]: Attempting to create Mall Ad with data:", {
      ...data,
      adminId: data.adminId,
    });

    let validAdminId = data.adminId;
    const userExists = await prisma.user.findUnique({ where: { id: data.adminId } });
    
    if (!userExists) {
      const fallbackAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
      if (fallbackAdmin) {
        validAdminId = fallbackAdmin.id;
        console.warn(`[ADS_ACTION]: Provided adminId ${data.adminId} not found. Using fallback admin: ${validAdminId}`);
      } else {
        throw new Error("No valid ADMIN user found in the database. Please ensure your user record is synced to the database.");
      }
    }

    // Using any cast to bypass stale generated client types while dev server holds files
    // Using any cast to ensure compatibility with all client versions
    const ad = await (prisma as any).mallAd.create({
      data: {
        title: data.title,
        description: data.description || "",
        imageUrl: data.imageUrl,
        linkUrl: data.linkUrl || "/public-view",
        priority: data.priority,
        startDate: data.startDate,
        endDate: data.endDate,
        adminId: validAdminId,
        storageKey: data.storageKey || null,
        isGlobal: true,
      },
    });
    console.log("[ADS_ACTION]: Mall Ad created successfully:", ad.id);

    revalidatePath("/admindashboard/ad-scheduler");
    revalidatePath("/public-view");
    return { success: true, ad };
  } catch (error: any) {
    console.error("[CREATE_MALL_AD_ERROR]:", error);
    return {
      success: false,
      error: error?.message || "Internal server error occurred.",
    };
  }
}

// Debug function to get all ads (Admin use)
export async function getAllMallAds() {
  try {
    return sortAds(await (prisma as any).mallAd.findMany({
      where: {
        isGlobal: true,
      },
    }));
  } catch (error) {
    console.error("[GET_ALL_MALL_ADS_ERROR]:", error);
    return [];
  }
}

export async function getActiveMallAds() {
  try {
    const now = new Date();
    return sortAds(await (prisma as any).mallAd.findMany({
      where: {
        OR: [
          { isDefault: true },
          {
            startDate: { lte: now },
            endDate: { gte: now },
          },
        ],
        isGlobal: true,
      },
    }));
  } catch (error) {
    console.error("[GET_ACTIVE_MALL_ADS_ERROR]:", error);
    return [];
  }
}

// New function to get all ads for public view (including admin ads)
export async function getAllActiveMallAds() {
  try {
    const now = new Date();
    return sortAds(await (prisma as any).mallAd.findMany({
      where: {
        OR: [
          { isDefault: true },
          {
            startDate: { lte: now },
            endDate: { gte: now },
          },
        ],
      },
    }));
  } catch (error) {
    console.error("[GET_ALL_ACTIVE_MALL_ADS_ERROR]:", error);
    return [];
  }
}

// ─── TENANT: SHOP-SPECIFIC PROMOS (APPROVAL PIPELINE) ─────────────────────

export async function createTenantPromo(data: {
  tenantId: string;
  title: string;
  description?: string;
  promoImage?: string;
  promoVideo?: string;
  category: string;
  startDate: Date;
  endDate: Date;
  mediaType: "IMAGE" | "VIDEO";
  storageKey?: string;
}) {
  try {
    console.log(
      "[PROMO_ACTION]: Attempting to create Tenant Promo for tenant:",
      data.tenantId,
    );
    // Using any cast to bypass stale generated client types
    const promo = await (prisma.tenantPromo as any).create({
      data: {
        title: data.title,
        description: data.description,
        promoImage: data.promoImage || null,
        promoVideo: data.promoVideo || null,
        category: data.category,
        startDate: data.startDate,
        endDate: data.endDate,
        tenantId: data.tenantId,
        mediaType: data.mediaType,
        status: "PENDING",
        storageKey: data.storageKey,
      },
      include: {
        tenant: true,
      },
    });

    // ── Notify Admins (preferences + channels honoured) ──
    const { notify } = await import("@/lib/notify");
    await notify("AD_SUBMISSION_RECEIVED", {
      title: "New Promo Submission",
      message: `Merchant ${promo.tenant.shopName} submitted "${promo.title}" (${promo.category}) running ${new Date(
        promo.startDate,
      ).toLocaleDateString()} to ${new Date(promo.endDate).toLocaleDateString()}. It is queued for review.`,
      link: "/admindashboard/ad-scheduler",
    });

    revalidatePath("/tenantdashboard/ad-promo-manager");
    revalidatePath("/admindashboard/ad-scheduler");
    return { success: true, promo };
  } catch (error: any) {
    console.error("[CREATE_PROMO_ERROR]:", error);
    return { success: false, error: error.message || "Failed to create promo" };
  }
}

export async function updatePromoStatus(
  promoId: string,
  status: "APPROVED" | "REJECTED",
  reason?: string,
) {
  try {
    const before = await (prisma as any).tenantPromo.findUnique({ where: { id: promoId }, select: { status: true } });
    const takenDown = status === "REJECTED" && before?.status === "APPROVED";
    const note = reason?.trim();
    const promo = await (prisma as any).tenantPromo.update({
      where: { id: promoId },
      data: { status },
      include: {
        tenant: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // ⚡ In-app alert for the decision, then the bespoke email only if the
    // tenant has the EMAIL channel enabled for this alert.
    const tenantUserId = promo.tenant?.user?.id;
    const isApproved = status === "APPROVED";

    if (tenantUserId) {
      const { notify, resolveChannels } = await import("@/lib/notify");

      await notify("AD_DECISION", {
        recipients: [tenantUserId],
        title: isApproved ? "Promo Approved" : takenDown ? "Promo Taken Down" : "Promo Rejected",
        message: isApproved
          ? `"${promo.title}" was approved and is live or scheduled for its start date.`
          : takenDown
            ? `"${promo.title}" was removed from the site by the mall office.${note ? ` Reason: ${note}` : ""}`
            : `"${promo.title}" wasn't approved.${note ? ` Reason: ${note}` : " It didn't meet the campaign guidelines."}`,
        link: "/tenantdashboard/ad-promo-manager",
        email: false,
      });

      const prefs = await resolveChannels("AD_DECISION", [tenantUserId]);
      const wantsEmail =
        prefs[tenantUserId]?.enabled &&
        prefs[tenantUserId]?.channels.includes("EMAIL");

      if (wantsEmail && promo.tenant?.user?.email) {
        try {
          const { sendGmail } = await import("@/lib/gmail");
          await sendGmail({
            to: promo.tenant.user.email,
            subject: `Campaign Update: Your Promo is ${takenDown ? "Taken Down" : status}`,
            html: `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: ${isApproved ? "#10b981" : "#be1e2d"};">Campaign ${status}</h2>
              <p>Hello ${promo.tenant.user.name || "Merchant"},</p>
              <p>The administration has reviewed your promotional campaign <strong>"${promo.title}"</strong>.</p>
              <hr />
              <p><strong>Status:</strong> ${status}</p>
              <hr />
              <p>${isApproved ? "Your campaign is now live or scheduled for its start date. Good luck with your promotion!" : takenDown ? "Your campaign was removed from the site by the mall office." : "Unfortunately, your campaign did not meet our guidelines at this time."}</p>
              ${note && !isApproved ? `<div style="background:#fef2f2;padding:12px 15px;border-radius:8px;border-left:4px solid #be1e2d;"><strong>Reason:</strong> ${note}</div>` : ""}
              <a href="${emailBaseUrl()}/tenantdashboard/ad-promo-manager" style="display: inline-block; padding: 10px 20px; background-color: #334155; color: white; text-decoration: none; border-radius: 5px;">Go to Campaign Manager</a>
            </div>
          `,
          });
        } catch (err) {
          console.error("Failed to send promo status update email:", err);
        }
      }
    }

    revalidatePath("/admindashboard/ad-scheduler");
    revalidatePath("/tenantdashboard/ad-promo-manager");
    revalidatePath("/public-view");
    return { success: true };
  } catch (error) {
    console.error("[UPDATE_PROMO_STATUS_ERROR]:", error);
    return { success: false, error: "Couldn't update the promo" };
  }
}

/** Approved tenant promos that haven't ended (live now or scheduled). */
export async function getLivePromosAction() {
  try {
    return await (prisma as any).tenantPromo.findMany({
      where: { status: "APPROVED", endDate: { gte: new Date() } },
      include: { tenant: { select: { shopName: true, unitId: true } } },
      orderBy: { startDate: "asc" },
    });
  } catch (error) {
    console.error("[GET_LIVE_PROMOS_ERROR]:", error);
    return [];
  }
}

export async function getPendingPromos() {
  try {
    return await (prisma as any).tenantPromo.findMany({
      where: { status: "PENDING" },
      include: { tenant: true },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    return [];
  }
}

export async function getActivePromos(category?: string) {
  try {
    const now = new Date();
    return await (prisma as any).tenantPromo.findMany({
      where: {
        status: "APPROVED",
        startDate: { lte: now },
        endDate: { gte: now },
        category: category || undefined,
      },
      orderBy: { startDate: "desc" },
    });
  } catch (error) {
    return [];
  }
}

export async function deletePromo(id: string, userId?: string) {
  try {
    const promo = await (prisma.tenantPromo as any).findUnique({
      where: { id },
      include: { tenant: { select: { userId: true } } },
    });
    if (!promo) return { success: false, error: "This promotion no longer exists." };
    // A tenant can only delete their own campaigns.
    if (userId && promo.tenant?.userId !== userId) {
      return { success: false, error: "You can only delete your own promotions." };
    }
    if (promo?.storageKey) {
      const storage = getCloudStorageProvider();
      await storage.deleteFile(promo.storageKey);
    }

    await (prisma as any).tenantPromo.delete({ where: { id } });
    revalidatePath("/tenantdashboard/ad-promo-manager");
    revalidatePath("/public-view");
    return { success: true };
  } catch (error) {
    console.error("[DELETE_PROMO_ERROR]:", error);
    return { success: false, error: "Couldn't delete the promotion." };
  }
}

export async function updateMallAd(
  id: string,
  data: {
    title?: string;
    description?: string;
    imageUrl?: string;
    linkUrl?: string;
    priority?: "HIGH" | "MEDIUM" | "LOW";
    startDate?: Date;
    endDate?: Date;
    storageKey?: string | null;
  },
) {
  try {
    const existing = await (prisma.mallAd as any).findUnique({ where: { id } });
    const updateData: any = { ...data };
    
    // Default ads always maintain far-future end date so they never expire
    if (existing?.isDefault) {
      updateData.isDefault = true;
      if (!updateData.endDate || new Date(updateData.endDate) < new Date()) {
        updateData.endDate = new Date("2099-12-31T23:59:59.000Z");
      }
    }

    const ad = await (prisma.mallAd as any).update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/admindashboard/ad-scheduler");
    revalidatePath("/public-view");
    return { success: true, ad };
  } catch (error: any) {
    console.error("[UPDATE_MALL_AD_ERROR]:", error);
    return {
      success: false,
      error: error?.message || "Database transaction failed",
    };
  }
}

export async function deleteMallAd(id: string) {
  try {
    const ad = await (prisma.mallAd as any).findUnique({ where: { id } });
    if (!ad) {
      return { success: false, error: "Ad not found." };
    }

    // Protection: default ads cannot be deleted
    if (ad.isDefault) {
      return { success: false, error: "Default mall banners cannot be deleted." };
    }

    if (ad.storageKey) {
      const storage = getCloudStorageProvider();
      await storage.deleteFile(ad.storageKey);
    }

    await (prisma as any).mallAd.delete({
      where: { id },
    });

    revalidatePath("/admindashboard/ad-scheduler");
    revalidatePath("/public-view");
    return { success: true };
  } catch (error) {
    console.error("[DELETE_MALL_AD_ERROR]:", error);
    return { success: false, error: "Failed to delete ad" };
  }
}

export async function getTenantByUserId(userId: string) {
  try {
    const tenant = await (prisma as any).tenant.findUnique({
      where: { userId },
    });
    return tenant;
  } catch (error) {
    console.error("[GET_TENANT_BY_USER_ID_ERROR]:", error);
    return null;
  }
}

export async function getPromosByTenant(tenantId: string) {
  try {
    return await (prisma as any).tenantPromo.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    return [];
  }
}

export async function updateTenantPromoStatus(
  id: string,
  status: "APPROVED" | "REJECTED",
) {
  try {
    await (prisma as any).tenantPromo.update({
      where: { id },
      data: { status },
    });

    // Revalidate the cache for public view and admin scheduler
    revalidatePath("/public-view");
    revalidatePath("/admindashboard/ad-scheduler");

    return { success: true };
  } catch (error) {
    console.error("[UPDATE_TENANT_PROMO_STATUS_ERROR]:", error);
    return { success: false, error: "Failed to update promo status" };
  }
}

export async function deleteTenantPromo(id: string) {
  try {
    const promo = await (prisma.tenantPromo as any).findUnique({
      where: { id },
    });
    if (promo?.storageKey) {
      const storage = getCloudStorageProvider();
      await storage.deleteFile(promo.storageKey);
    }

    await (prisma as any).tenantPromo.delete({
      where: { id },
    });

    revalidatePath("/tenantdashboard/ad-promo-manager");
    revalidatePath("/admindashboard/ad-scheduler");
    return { success: true };
  } catch (error) {
    console.error("[DELETE_TENANT_PROMO_ERROR]:", error);
    return { success: false, error: "Failed to delete promo" };
  }
}

export async function getApprovedTenantPromos() {
  try {
    const now = new Date();
    return await (prisma as any).tenantPromo.findMany({
      where: {
        status: "APPROVED",
        startDate: { lte: now },
        endDate: { gte: now },
      },
      include: {
        tenant: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("[GET_APPROVED_TENANT_PROMOS_ERROR]:", error);
    return [];
  }
}

/** A shop's approved promos that are running now (shop page "Current promos"). */
export async function getShopActivePromosAction(tenantId: string) {
  try {
    if (!tenantId) return [];
    const now = new Date();
    return await (prisma as any).tenantPromo.findMany({
      where: { tenantId, status: "APPROVED", startDate: { lte: now }, endDate: { gte: now } },
      select: { id: true, title: true, description: true, category: true, mediaType: true, promoImage: true, promoVideo: true, startDate: true, endDate: true },
      orderBy: { startDate: "desc" },
    });
  } catch (error) {
    console.error("[GET_SHOP_ACTIVE_PROMOS_ERROR]:", error);
    return [];
  }
}
