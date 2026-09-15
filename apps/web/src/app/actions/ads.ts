"use server";

import { prisma } from "@srmall/database";
import { revalidatePath } from "next/cache";
import { getCloudStorageProvider } from "@/lib/cloud-storage";

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
    return await (prisma as any).mallAd.findMany({
      where: {
        isGlobal: true,
      },
      orderBy: [{ isDefault: "desc" }, { priority: "asc" }, { startDate: "desc" }],
    });
  } catch (error) {
    console.error("[GET_ALL_MALL_ADS_ERROR]:", error);
    return [];
  }
}

export async function getActiveMallAds() {
  try {
    const now = new Date();
    return await (prisma as any).mallAd.findMany({
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
      orderBy: [
        { isDefault: "desc" },
        { priority: "asc" },
        { startDate: "desc" },
      ],
    });
  } catch (error) {
    console.error("[GET_ACTIVE_MALL_ADS_ERROR]:", error);
    return [];
  }
}

// New function to get all ads for public view (including admin ads)
export async function getAllActiveMallAds() {
  try {
    const now = new Date();
    return await (prisma as any).mallAd.findMany({
      where: {
        OR: [
          { isDefault: true },
          {
            startDate: { lte: now },
            endDate: { gte: now },
          },
        ],
      },
      orderBy: [{ isDefault: "desc" }, { priority: "asc" }, { startDate: "desc" }],
    });
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

    // ── Notify Admins ──
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin: { id: string }) => ({
          userId: admin.id,
          type: "AD_SUBMISSION_RECEIVED",
          title: "New Promo Submission",
          message: `Merchant ${promo.tenant.shopName} has submitted a new campaign for review.`,
        })),
      });

      // Gmail notification to Admin
      try {
        const { sendGmail } = await import("@/lib/gmail");
        await sendGmail({
          to: process.env.GMAIL_USER || "jerickaradilla76@gmail.com",
          subject: `📢 NEW PROMO SUBMISSION: ${promo.tenant.shopName}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #6366f1;">New Targeted Campaign Request</h2>
              <p>The merchant <strong>${promo.tenant.shopName}</strong> has submitted a new promotion for approval.</p>
              <hr />
              <p><strong>Campaign:</strong> ${promo.title}</p>
              <p><strong>Category:</strong> ${promo.category}</p>
              <p><strong>Visibility:</strong> ${new Date(promo.startDate).toLocaleDateString()} to ${new Date(promo.endDate).toLocaleDateString()}</p>
              <hr />
              <p>Please log in to the Ad Scheduler to review the media assets and approve this campaign.</p>
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/admindashboard/ad-scheduler" style="display: inline-block; padding: 10px 20px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 5px;">Go to Scheduler</a>
            </div>
          `,
        });
      } catch (err) {
        console.error("Failed to send Admin Gmail for promo update:", err);
      }
    }

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
) {
  try {
    const promo = await (prisma as any).tenantPromo.update({
      where: { id: promoId },
      data: { status },
      include: {
        tenant: {
          include: {
            user: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Notify Tenant of the decision
    if (promo.tenant?.user?.email) {
      const isApproved = status === "APPROVED";
      try {
        const { sendGmail } = await import("@/lib/gmail");
        await sendGmail({
          to: promo.tenant.user.email,
          subject: `Campaign Update: Your Promo is ${status}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: ${isApproved ? "#10b981" : "#be1e2d"};">Campaign ${status}</h2>
              <p>Hello ${promo.tenant.user.name || "Merchant"},</p>
              <p>The administration has reviewed your promotional campaign <strong>"${promo.title}"</strong>.</p>
              <hr />
              <p><strong>Status:</strong> ${status}</p>
              <hr />
              <p>${isApproved ? "Your campaign is now live or scheduled for its start date. Good luck with your promotion!" : "Unfortunately, your campaign did not meet our guidelines at this time. Please check your dashboard for details."}</p>
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/tenantdashboard/ad-promo-manager" style="display: inline-block; padding: 10px 20px; background-color: #334155; color: white; text-decoration: none; border-radius: 5px;">Go to Campaign Manager</a>
            </div>
          `,
        });
      } catch (err) {
        console.error("Failed to send promo status update email:", err);
      }
    }

    revalidatePath("/admindashboard/ad-scheduler");
    revalidatePath("/tenantdashboard/ad-promo-manager");
    revalidatePath("/public-view");
    return { success: true };
  } catch (error) {
    console.error("[UPDATE_PROMO_STATUS_ERROR]:", error);
    return { success: false };
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

export async function deletePromo(id: string) {
  try {
    const promo = await (prisma.tenantPromo as any).findUnique({
      where: { id },
    });
    if (promo?.storageKey) {
      const storage = getCloudStorageProvider();
      await storage.deleteFile(promo.storageKey);
    }

    await (prisma as any).tenantPromo.delete({ where: { id } });
    revalidatePath("/tenantdashboard/ad-promo-manager");
    return { success: true };
  } catch (error) {
    return { success: false };
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
