"use server";

import { requireSelf, requireStaffAny, requireStore } from "@/lib/action-guard";
import { isListed } from "@/lib/products";
import { prisma } from "@srmall/database";
import { emailBaseUrl } from "@/utils/get-base-url";
import { SHOP_CATEGORIES } from "@/lib/shop-categories";
import bcrypt from "bcryptjs";
import { safeUserSelect } from "@/lib/user-select";
import { DigitalStorefront } from "@/types/storefront";
import { revalidatePath } from "next/cache";
import { occupySlot } from "./space-slot";
import { recordTenantExit } from "@/lib/tenant-history";
import { listFloors } from "@/lib/floors-server";
import { PAGE_SIZE, clampPage, likeText } from "@/lib/paging";
import { rentOf } from "@/lib/tenant-rent";
import { findShop, listPublicShops, ownShop, shopKey, shopOfLease, type Shop } from "@/lib/shops";
import { resolveWorkspace } from "@/lib/workspace-server";
import type { Account } from "@/lib/auth-server";

/** A shop in the shape the pages use. */
const toStorefront = (s: Shop) =>
  ({
    id: s.id,
    tenant_id: s.tenantId,
    shop_name: s.shopName,
    unit_id: s.unitId,
    is_open: s.isOpen,
    description: s.description,
    logo_url: s.logoUrl,
    gallery_urls: s.galleryUrls,
    products: s.products as any,
    post_sales: s.postSales as any,
    category: s.category,
  }) as DigitalStorefront;

/**
 * The shop the signed-in tenant (or their staff) is working in: the one for the
 * space chosen in the workspace menu. Mall staff get the tenant's main shop.
 */
async function workspaceShop(account: Account, tenant: { id: string }) {
  if (account.type !== "TENANT") return shopOfLease(tenant.id, null);
  const { lease } = await resolveWorkspace(tenant.id, account.tenantStaff?.leaseId);
  // Staff only ever work in their own space.
  if (account.tenantStaff && !lease) return null;
  return shopOfLease(tenant.id, lease);
}

/**
 * Updates or creates a tenant's digital storefront profile.
 * Ensure the userId is valid and linked to a user with the TENANT role.
 */
export async function updateStorefrontAction(
  userId: string,
  profile: Partial<DigitalStorefront>,
) {
  try {
    const account = await requireStore(userId, { sections: ["storefront"], staff: ["tenant_monitoring"] });
    const mallStaff = account.type === "ADMIN";
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return {
        success: false,
        error: "User context not found. Please log in again.",
      };
    }

    // Clean product stock / status (whole number ≥ 0 or blank; known status).
    if (Array.isArray(profile.products)) {
      profile = {
        ...profile,
        products: profile.products.map((p: any) => {
          const n = p?.stock === "" || p?.stock == null ? null : Math.floor(Number(p.stock));
          return {
            ...p,
            stock: n !== null && Number.isFinite(n) && n >= 0 ? Math.min(n, 1_000_000) : null,
            status: ["AVAILABLE", "OUT_OF_STOCK", "HIDDEN"].includes(p?.status) ? p.status : "AVAILABLE",
          };
        }),
      };
    }

    // Save to the shop the page loaded (profile.id), not whatever the workspace
    // menu says now: another tab may have switched spaces meanwhile.
    const main = await prisma.tenant.findUnique({ where: { userId } });
    if (main) {
      const target = await ownShop(main.id, profile.id || main.id);
      if (!target) return { success: false, error: "That shop isn't linked to this account. Reload the page." };
      if (account.tenantStaff) {
        const lease = await prisma.lease.findUnique({
          where: { id: account.tenantStaff.leaseId },
          select: { shopId: true, status: true },
        });
        if (lease?.status !== "ACTIVE" || lease.shopId !== shopKey(target)) {
          return { success: false, error: "You can only edit the shop of your own space." };
        }
      }
      if (!target.isMain) {
        const name = profile.shop_name?.trim();
        if (profile.shop_name !== undefined && !name) return { success: false, error: "Give this shop a name." };
        await prisma.unitShop.update({
          where: { id: target.id },
          data: {
            shopName: name,
            isOpen: profile.is_open,
            description: profile.description,
            logoUrl: profile.logo_url,
            galleryUrls: profile.gallery_urls,
            products: profile.products as any,
            postSales: profile.post_sales as any,
            category: profile.category,
          },
        });
        revalidatePath("/tenantdashboard/digital-storefront");
        revalidatePath("/");
        return { success: true, data: toStorefront((await ownShop(main.id, target.id))!) };
      }
    }

    const tenant = await prisma.tenant.upsert({
      where: { userId },
      update: {
        shopName: profile.shop_name,
        // Units are assigned by the mall office, never from the shop editor.
        // (A shop with several units shows them as a list: never save that back.)
        unitId: mallStaff && !profile.unit_id?.includes(",") ? profile.unit_id : undefined,
        isOpen: profile.is_open,
        description: profile.description,
        logoUrl: profile.logo_url,
        galleryUrls: profile.gallery_urls,
        products: profile.products as any,
        postSales: profile.post_sales as any,
        category: profile.category,
      },
      create: {
        userId,
        shopName: profile.shop_name || "Untitled Shop",
        unitId: (mallStaff && profile.unit_id) || "PENDING",
        isOpen: profile.is_open ?? true,
        description: profile.description || "",
        logoUrl: profile.logo_url,
        galleryUrls: profile.gallery_urls || [],
        products: (profile.products || []) as any,
        postSales: (profile.post_sales || []) as any,
        category: profile.category || "Fashion",
      },
    } as any);

    revalidatePath("/tenantdashboard/digital-storefront");
    revalidatePath("/tenantdashboard/profile-settings");
    revalidatePath("/");

    return {
      success: true,
      data: toStorefront((await ownShop(tenant.id, tenant.id))!),
    };
  } catch (error: any) {
    console.error("[UPDATE_STOREFRONT_ERROR]:", error);
    return {
      success: false,
      error: error.message || "Failed to update storefront profile",
    };
  }
}

export async function updateTenantProfileAction(
  userId: string,
  data: {
    name?: string;
    email?: string;
    shopName?: string;
    description?: string;
    logoUrl?: string;
  },
) {
  try {
    await requireSelf(userId);
    const updateTasks = [];

    // The email follows the same rules as the other settings pages: Gmail only,
    // and never for Google-only accounts (it's their Google identity).
    if (data.email) {
      const email = data.email.trim().toLowerCase();
      const me = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, password: true } });
      if (me && email !== me.email) {
        if (me.password === "GOOGLE_OAUTH" || me.password === "OAUTH_USER") {
          return { success: false, error: "Your account signs in with Google, so its email can't be changed." };
        }
        if (!/^[^\s@]+@gmail\.com$/.test(email)) {
          return { success: false, error: "Your email must be a Gmail address (@gmail.com)." };
        }
      }
      data.email = email;
    }

    // Update User details
    if (data.name || data.email) {
      updateTasks.push(
        prisma.user.update({
          where: { id: userId },
          data: {
            name: data.name,
            email: data.email,
          },
        }),
      );
    }

    // Update Tenant details
    if (
      data.shopName !== undefined ||
      data.description !== undefined ||
      data.logoUrl !== undefined
    ) {
      updateTasks.push(
        prisma.tenant.update({
          where: { userId },
          data: {
            shopName: data.shopName,
            description: data.description,
            logoUrl: data.logoUrl,
          },
        }),
      );
    }

    await Promise.all(updateTasks);

    revalidatePath("/tenantdashboard/profile-settings");
    revalidatePath("/tenantdashboard");

    return { success: true };
  } catch (error: any) {
    console.error("[UPDATE_PROFILE_ERROR]:", error);
    return { success: false, error: error.message };
  }
}

export async function getStorefrontAction(userId: string) {
  try {
    const account = await requireStore(userId, { sections: ["overview", "storefront", "payments"], staff: ["tenant_monitoring"] });
    const tenant = await prisma.tenant.findUnique({
      where: { userId },
    });

    if (!tenant) return { success: false, error: "No storefront found" };
    const shop = await workspaceShop(account, tenant);
    if (!shop) return { success: false, error: "No storefront found" };

    return { success: true, data: toStorefront(shop) };
  } catch (error: any) {
    console.error("[GET_STOREFRONT_ERROR]:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch storefront",
    };
  }
}

export async function getTenantProfileAction(userId: string) {
  try {
    await requireSelf(userId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
      },
    });

    if (!user) return { success: false, error: "User not found" };

    return {
      success: true,
      data: {
        name: user.name,
        email: user.email,
        shopName: user.tenant?.shopName || "",
        description: user.tenant?.description || "",
        logoUrl: user.tenant?.logoUrl || "",
        unitId: user.tenant?.unitId || "N/A",
        status: user.tenant?.status || "ACTIVE",
      },
    };
  } catch (error: any) {
    console.error("[GET_PROFILE_ERROR]:", error);
    return { success: false, error: error.message };
  }
}

export async function deactivateTenantTerminalAction(userId: string) {
  try {
    await requireSelf(userId);
    await prisma.tenant.update({
      where: { userId },
      data: { status: "SUSPENDED" },
    });

    revalidatePath("/tenantdashboard/profile-settings");
    revalidatePath("/admindashboard/tenant-monitoring");

    return { success: true };
  } catch (error: any) {
    console.error("[DEACTIVATE_TENANT_ERROR]:", error);
    return { success: false, error: error.message };
  }
}

/** Rating (approved reviews) and floor (from the unit) for directory cards. */
async function storefrontExtras(shops: Pick<Shop, "id" | "tenantId" | "unitId" | "unitIds">[]) {
  const ids = [...new Set(shops.map((t) => t.tenantId))];
  const firstUnit = (t: Pick<Shop, "unitId" | "unitIds">) => t.unitIds[0] ?? t.unitId;
  const units = shops.map(firstUnit).filter((u): u is string => !!u && u !== "PENDING_ASSIGNMENT");
  const now = new Date();
  const [ratings, slots, promos] = await Promise.all([
    ids.length
      ? prisma.review.groupBy({
          by: ["tenantId", "shopId"],
          where: { tenantId: { in: ids }, isApproved: true },
          _avg: { rating: true },
          _count: { _all: true },
        })
      : Promise.resolve([] as any[]),
    units.length
      ? prisma.areaSlot.findMany({ where: { unit_id: { in: units } }, select: { unit_id: true, floor: true } })
      : Promise.resolve([] as { unit_id: string; floor: string }[]),
    // The promo the admin approved that is running right now (newest per shop).
    ids.length
      ? prisma.tenantPromo.findMany({
          where: { tenantId: { in: ids }, status: "APPROVED", startDate: { lte: now }, endDate: { gte: now } },
          select: { id: true, tenantId: true, shopId: true, title: true, mediaType: true, promoImage: true, promoVideo: true, endDate: true },
          orderBy: { startDate: "desc" },
        })
      : Promise.resolve([] as any[]),
  ]);
  // Keyed by public shop id (the tenant id for a main shop).
  const ratingBy = new Map(ratings.map((r: any) => [r.shopId ?? r.tenantId, { avg: r._avg.rating || 0, count: r._count._all }]));
  const floorBy = new Map(slots.map((s) => [s.unit_id, s.floor]));
  const promoBy = new Map<string, any>();
  // A promo belongs to one shop; a main shop's id is the tenant's id.
  for (const p of promos as any[]) {
    const key = p.shopId ?? p.tenantId;
    if (!promoBy.has(key)) promoBy.set(key, p);
  }
  return (t: Pick<Shop, "id" | "unitId" | "unitIds">) => {
    const p = promoBy.get(t.id);
    return {
      avgRating: ratingBy.get(t.id)?.avg ?? 0,
      reviewCount: ratingBy.get(t.id)?.count ?? 0,
      floor: floorBy.get(firstUnit(t)) || null,
      activePromo: p
        ? {
            id: p.id,
            title: p.title,
            mediaType: p.mediaType === "VIDEO" && p.promoVideo ? ("VIDEO" as const) : ("IMAGE" as const),
            image: p.promoImage || null,
            video: p.promoVideo || null,
            endDate: new Date(p.endDate).toISOString(),
          }
        : null,
    };
  };
}

/**
 * Directory cards only: no product lists or sales posts (they can be large),
 * just what the card shows.
 */
export async function getDirectoryShopsAction() {
  try {
    const shops = await listPublicShops();
    const extras = await storefrontExtras(shops);
    return {
      success: true,
      data: shops.map((s) => {
        const { products: _p, post_sales: _s, ...card } = toStorefront(s);
        return { ...card, ...extras(s) } as DigitalStorefront;
      }),
    };
  } catch (error: any) {
    console.error("[GET_DIRECTORY_SHOPS_ERROR]:", error);
    return { success: false, error: error.message || "Failed to fetch directory" };
  }
}

/** Public view of a shop's products: hidden ones removed. */
function publicProducts(products: unknown): any {
  return (Array.isArray(products) ? products : []).filter((p: any) => p && isListed(p));
}

export async function getAllStorefrontsAction() {
  try {
    const shops = await listPublicShops();
    const extras = await storefrontExtras(shops);

    return {
      success: true,
      data: shops.map(
        (s) =>
          ({
            ...toStorefront(s),
            // Products hidden by the shop never reach public pages.
            products: publicProducts(s.products),
            ...extras(s),
          }) as DigitalStorefront,
      ),
    };
  } catch (error: any) {
    console.error("[GET_ALL_STOREFRONTS_ERROR]:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch directory",
    };
  }
}

export async function getAllTenantsAction() {
  try {
    await requireStaffAny("tenant_monitoring", "payments");
    const tenants = await (prisma as any).tenant.findMany({
      orderBy: { shopName: "asc" },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        reviews: {
          where: { isApproved: true },
          select: { rating: true },
        },
        leases: {
          where: { status: "ACTIVE" },
          select: { unitId: true, startDate: true, endDate: true, monthlyRent: true },
        },
      },
    });

    return {
      success: true,
      data: tenants.map((t: any) => {
        const totalRating = t.reviews.reduce(
          (acc: number, r: any) => acc + r.rating,
          0,
        );
        const avgRating =
          t.reviews.length > 0 ? totalRating / t.reviews.length : 0;

        return {
          id: t.id,
          shopName: t.shopName,
          unitId: t.unitId,
          status: t.status,
          user: t.user,
          description: t.description,
          logoUrl: t.logoUrl,
          galleryUrls: t.galleryUrls,
          products: t.products,
          postSales: t.postSales,
          avgRating,
          reviewCount: t.reviews.length,
          category: t.category,
          createdAt: t.createdAt,
          leases: t.leases,
        };
      }),
    };
  } catch (error: any) {
    console.error("[GET_ALL_TENANTS_ERROR]:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch tenants",
    };
  }
}

/**
 * Fetch a specific shop profile by its primary database ID.
 */
export async function getStorefrontByIdAction(id: string) {
  try {
    const shop = await findShop(id);

    if (!shop) return { success: false, error: "Shop not found" };

    return {
      success: true,
      data: {
        ...toStorefront(shop),
        products: publicProducts(shop.products),
        phone: shop.phone,
        opening_hours: shop.openingHours,
      } as DigitalStorefront,
    };
  } catch (error: any) {
    console.error("[GET_STOREFRONT_BY_ID_ERROR]:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch shop details",
    };
  }
}
/**
 * Check if email already exists in database
 */
export async function checkEmailExists(email: string) {
  try {
    await requireStaffAny("tenant_monitoring");
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    return { success: true, exists: !!existingUser };
  } catch (error: any) {
    console.error("[CHECK_EMAIL_ERROR]:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Registers a new tenant from the Admin Dashboard.
 * Creates a User account + Tenant profile in a single workflow.
 */
export async function registerTenantAction(data: {
  email: string;
  password: string;
  shopName: string;
  category: string;
  unitId: string;
  rentCost: number;
}) {
  try {
    await requireStaffAny("tenant_monitoring");
    // New accounts must use a Gmail address.
    const email = (data.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@gmail\.com$/.test(email)) {
      return { success: false, error: "Use the tenant's Gmail address (@gmail.com)." };
    }

    // 1. Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      return {
        success: false,
        error: "User already exists with this email address.",
      };
    }

    // 2. Hash the temporary password before saving
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // 3. Create the User & Tenant in a transaction
    const result = await prisma.$transaction(async (tx: any) => {
      const newUser = await tx.user.create({
        data: {
          email,
          password: hashedPassword, // Store securely
          name: data.shopName,
          role: "TENANT",
        },
      });

      const newTenant = await tx.tenant.create({
        data: {
          userId: newUser.id,
          shopName: data.shopName,
          unitId: data.unitId,
          status: "ACTIVE",
          description: `${data.category} shop at SR Mall.`,
          galleryUrls: [],
          products: [],
        },
      });

      return { user: newUser, tenant: newTenant };
    });

    revalidatePath("/");
    revalidatePath("/admindashboard/tenant-monitoring");

    // Occupy the slot after successful registration
    await occupySlot(data.unitId);

    return {
      success: true,
      data: {
        userId: result.user.id,
        tenantId: result.tenant.id,
        shopName: result.tenant.shopName,
      },
    };
  } catch (error: any) {
    console.error("[REGISTER_TENANT_ERROR]:", error);
    return {
      success: false,
      error: error.message || "Failed to register new tenant",
    };
  }
}

export async function approveTenantAction(tenantId: string, unitId?: string) {
  try {
    await requireStaffAny("bookings", "tenant_monitoring");
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { user: { select: safeUserSelect } },
    });

    if (!tenant) return { success: false, error: "Application not found" };

    await prisma.$transaction([
      prisma.user.update({
        where: { id: tenant.userId },
        data: { role: "TENANT" },
      }),
      prisma.tenant.update({
        where: { id: tenantId },
        data: {
          status: "ACTIVE",
          ...(unitId && { unitId }),
        },
      }),
    ]);

    if (unitId && unitId !== "PENDING_ASSIGNMENT") {
      await occupySlot(unitId);
    }

    revalidatePath("/admindashboard/tenant-monitoring");
    revalidatePath("/admindashboard/space-manager");
    revalidatePath("/");

    const { notify } = await import("@/lib/notify");
    await notify("MERCHANT_APPLICATION_UPDATE", {
      recipients: [tenant.userId],
      title: `Welcome to SR Mall 🎉 · ${tenant.shopName}`,
      message: `Your application was approved${unitId && unitId !== "PENDING_ASSIGNMENT" ? ` for Unit ${unitId}` : ""}. Your tenant dashboard is ready. Set up your storefront to go live.`,
      link: "/tenantdashboard",
      email: false,
    });

    // Gmail Notification to User
    if (tenant.user && tenant.user.email) {
      try {
        const { sendGmail } = await import("@/lib/gmail");
        await sendGmail({
          to: tenant.user.email,
          subject: "Welcome to SR Mall: Your Merchant Partnership is Approved!",
          html: `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #10b981;">Partnership Approved</h2>
              <p>Hello ${tenant.user.name || "Merchant"},</p>
              <p>We are thrilled to inform you that your application for a storefront partnership at SR Mall has been <strong>APPROVED</strong>.</p>
              <hr />
              <p><strong>Shop Name:</strong> ${tenant.shopName}</p>
              ${unitId ? `<p><strong>Assigned Unit:</strong> ${unitId}</p>` : ""}
              <hr />
              <p>You can now access your Merchant Command Center to manage your digital storefront, upload products, and monitor your business analytics.</p>
              <a href="${emailBaseUrl()}/tenantdashboard" style="display: inline-block; padding: 10px 20px; background-color: #10b981; color: white; text-decoration: none; border-radius: 5px;">Go to Dashboard</a>
              <p style="margin-top: 20px; font-size: 12px; color: #666;">If you have any questions, our management team is here to support you.</p>
            </div>
          `,
        });
      } catch (err) {
        console.error("Failed to send merchant approval email:", err);
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error("[APPROVE_TENANT_ERROR]:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteTenantAction(tenantId: string, _adminUserId?: string) {
  try {
    const actorId = (await requireStaffAny("tenant_monitoring")).id;
    // First get the tenant to find the associated user
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { user: { select: safeUserSelect } },
    });

    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    // Keep a permanent history record before the tenant (and invoices) are deleted.
    // A tenant already marked PAST was recorded when that happened.
    if (tenant.status !== "PAST" && tenant.status !== "PENDING" && tenant.status !== "REJECTED") {
      await recordTenantExit(tenantId, "REMOVED", { endedById: actorId });
    }

    // Free up the unit if they had one
    if (tenant.unitId && tenant.unitId !== "PENDING_ASSIGNMENT") {
      try {
        await prisma.areaSlot.update({
          where: { unit_id: tenant.unitId },
          data: { status: "AVAILABLE", tenant_id: null },
        });
      } catch (e) {
        console.warn(`Could not free unit ${tenant.unitId}`, e);
      }
    }

    // Use a transaction to ensure both operations complete atomically
    await prisma.$transaction(async (tx: any) => {
      // Revert the user back to CUSTOMER instead of deleting them
      if (tenant.userId) {
        await tx.user.update({
          where: { id: tenant.userId },
          data: { role: "CUSTOMER" },
        });
      }

      // Delete the tenant profile
      await tx.tenant.delete({
        where: { id: tenantId },
      });
    });

    revalidatePath("/admindashboard/tenant-monitoring");
    revalidatePath("/admindashboard/space-manager");
    revalidatePath("/admindashboard/user-management");
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("[DELETE_TENANT_ERROR]:", error);
    return {
      success: false,
      error: error.message || "Failed to delete tenant",
    };
  }
}

export async function getTenantReportDataAction(filter?: {
  month?: number;
  year?: number;
}) {
  try {
    await requireStaffAny("tenant_monitoring", "payments");
    const tenants = await (prisma as any).tenant.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        invoices: {
          orderBy: { createdAt: "desc" },
        },
        leases: {
          where: { status: "ACTIVE" },
          select: { unitId: true, startDate: true, endDate: true, monthlyRent: true },
        },
      },
    });

    const [slots, floors] = await Promise.all([prisma.areaSlot.findMany(), listFloors()]);
    // Real payment dates (newer column; raw SQL until the client is regenerated).
    const paidAtRows = await prisma
      .$queryRawUnsafe<{ id: string; paidAt: Date }[]>(
        `SELECT "id", "paidAt" FROM "Invoice" WHERE "paidAt" IS NOT NULL`,
      )
      .catch(() => [] as { id: string; paidAt: Date }[]);
    const paidAtById = new Map(paidAtRows.map((r) => [r.id, r.paidAt]));
    const paidDate = (inv: any) => paidAtById.get(inv.id) || inv.updatedAt || inv.createdAt;

    const data: any[] = tenants.map((t: any) => {
      const rent = rentOf(t, slots);

      const relevantInvoices = t.invoices.filter((inv: any) => {
        if (inv.status === "VOID") return false;
        if (!filter) return true;
        const d = new Date(inv.dueDate || inv.createdAt);
        if (filter.year !== undefined && d.getFullYear() !== filter.year) return false;
        if (filter.month !== undefined && d.getMonth() !== filter.month) return false;
        return true;
      });

      const unpaidInvoices = relevantInvoices.filter(
        (inv: any) => inv.status !== "PAID",
      );
      const balance = unpaidInvoices.reduce(
        (sum: number, inv: any) => sum + inv.amount,
        0,
      );

      // Most recently *paid* invoice (not the most recently created one).
      const lastPaidInvoice = relevantInvoices
        .filter((inv: any) => inv.status === "PAID")
        .sort((a: any, b: any) => new Date(paidDate(b)).getTime() - new Date(paidDate(a)).getTime())[0];
      const lastPaymentDate = lastPaidInvoice ? paidDate(lastPaidInvoice) : null;
      const lastReceiptNo = relevantInvoices[0] ? relevantInvoices[0].invoiceNumber : null;

      // Find the earliest due date among unpaid invoices
      const overdueInvoice = unpaidInvoices.sort(
        (a: any, b: any) =>
          new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      )[0];
      const nextDueDate = overdueInvoice ? overdueInvoice.dueDate : null;

      // The floor of the tenant's first unit; shops without one are listed last.
      const unit = slots.find((s) => s.unit_id === (rent.units[0] ?? t.unitId));
      const floor = unit && floors.find((f) => f.id === unit.floor);

      return {
        id: t.id,
        shopName: t.shopName,
        tenantOwner: t.user?.name || t.user?.email || "N/A",
        unitId: rent.units.join(", ") || t.unitId,
        sqmSize: rent.sqm,
        monthlyRent: rent.monthlyRent,
        balance,
        lastPaymentDate,
        lastReceiptNo,
        nextDueDate,
        leaseExpiryDate: rent.paidThrough,
        category: t.category || "Other",
        status:
          relevantInvoices[0]?.status === "PAID"
            ? "PAID"
            : relevantInvoices[0]?.status || (filter ? (t.status === "ACTIVE" ? "ACTIVE" : t.status || "N/A") : t.invoices[0]?.status || "PENDING"),
        floorLevel: floor ? floor.name : "No floor",
        floorOrder: floor ? floor.level : Number.MAX_SAFE_INTEGER,
      };
    });

    // Solve "Organize the list by Floor Level"
    data.sort((a: any, b: any) => a.floorOrder - b.floorOrder);

    return { success: true, data };
  } catch (error: any) {
    console.error("[GET_TENANT_REPORT_DATA_ERROR]:", error);
    return { success: false, error: error.message };
  }
}

export async function adminUpdateTenantAction(
  tenantId: string,
  data: {
    shopName?: string;
    unitId?: string;
    status?: string;
    description?: string;
    rentCost?: number;
  },
  _adminUserId?: string,
) {
  try {
    const actorId = (await requireStaffAny("tenant_monitoring")).id;
    const currentTenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!currentTenant) return { success: false, error: "Tenant not found" };

    if (data.status === "PAST" && currentTenant.status !== "PAST") {
      await recordTenantExit(tenantId, "MARKED_PAST", { endedById: actorId });
    }

    const targetUnitId = data.unitId || currentTenant.unitId;

    // Handle Unit ID change logic
    if (data.unitId && data.unitId !== currentTenant.unitId) {
      // 1. Free old slot
      if (
        currentTenant.unitId &&
        currentTenant.unitId !== "PENDING_ASSIGNMENT"
      ) {
        try {
          await prisma.areaSlot.update({
            where: { unit_id: currentTenant.unitId },
            data: { status: "AVAILABLE", tenant_id: null },
          });
        } catch (e) {
          console.warn(`Could not free unit ${currentTenant.unitId}`, e);
        }
      }
      // 2. Occupy new slot
      await occupySlot(data.unitId);
    }

    // Handle Rent update if provided
    if (
      data.rentCost !== undefined &&
      targetUnitId &&
      targetUnitId !== "PENDING_ASSIGNMENT"
    ) {
      await prisma.areaSlot.update({
        where: { unit_id: targetUnitId },
        data: { base_rent: data.rentCost },
      });
    }

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        shopName: data.shopName,
        unitId: data.unitId,
        status: data.status,
        description: data.description,
      },
    });

    revalidatePath("/admindashboard/tenant-monitoring");
    revalidatePath("/");

    return { success: true, data: updated };
  } catch (error: any) {
    console.error("[ADMIN_UPDATE_TENANT_ERROR]:", error);
    return {
      success: false,
      error: error.message || "Failed to update tenant",
    };
  }
}

/**
 * Fetch all post sales for Admin monitoring
 */
export async function getAllPostSalesAction() {
  try {
    await requireStaffAny("cms");
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        shopName: true,
        postSales: true,
      },
    });

    const units = await prisma.unitShop.findMany({ select: { id: true, shopName: true, postSales: true } });

    // `tenantId` here is the shop's id (a unit shop's own id for extra units).
    const allPostSales = [...tenants, ...units].flatMap((tenant) => {
      const sales = Array.isArray(tenant.postSales) ? tenant.postSales : [];
      return sales.map((sale: any) => ({
        ...sale,
        tenantId: tenant.id,
        shopName: tenant.shopName,
      }));
    });

    return { success: true, data: allPostSales };
  } catch (error: any) {
    console.error("[GET_ALL_POST_SALES_ERROR]:", error);
    return { success: false, error: error.message };
  }
}

/** Whichever table holds this shop, for the staff sale tools. */
async function findShopRow(shopId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: shopId }, select: { id: true, postSales: true } });
  if (tenant) return { ...tenant, isMain: true };
  const unit = await prisma.unitShop.findUnique({ where: { id: shopId }, select: { id: true, postSales: true } });
  return unit ? { ...unit, isMain: false } : null;
}

async function saveShopSales(shop: { id: string; isMain: boolean }, sales: unknown[]) {
  const data = { postSales: sales as any };
  if (shop.isMain) await prisma.tenant.update({ where: { id: shop.id }, data });
  else await prisma.unitShop.update({ where: { id: shop.id }, data });
}

/**
 * Delete a specific post sale by admin
 */
export async function deleteAdminPostSaleAction(tenantId: string, saleId: string) {
  try {
    await requireStaffAny("cms");
    const shop = await findShopRow(tenantId);
    if (!shop) return { success: false, error: "Shop not found" };

    const sales = Array.isArray(shop.postSales) ? shop.postSales : [];
    const updatedSales = sales.filter((s: any) => s.id !== saleId);

    await saveShopSales(shop, updatedSales);

    revalidatePath("/admindashboard/public-view-cms");
    revalidatePath("/");

    return { success: true };
  } catch (error: any) {
    console.error("[DELETE_POST_SALE_ERROR]:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Update a specific post sale by admin
 */
export async function updateAdminPostSaleAction(tenantId: string, saleId: string, newImageUrl: string, newTitle: string) {
  try {
    await requireStaffAny("cms");
    const shop = await findShopRow(tenantId);
    if (!shop) return { success: false, error: "Shop not found" };

    const sales = Array.isArray(shop.postSales) ? shop.postSales : [];
    const updatedSales = sales.map((s: any) =>
      s.id === saleId ? { ...s, image_url: newImageUrl, title: newTitle } : s
    );

    await saveShopSales(shop, updatedSales);

    revalidatePath("/admindashboard/public-view-cms");
    revalidatePath("/");

    return { success: true };
  } catch (error: any) {
    console.error("[UPDATE_POST_SALE_ERROR]:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Tenant History for the admin: snapshots saved when a tenant left (see
 * lib/tenant-history.ts), newest first. Returns one page of the matches, or all
 * of them for the CSV export.
 */
export async function getPastTenantsAction(
  input: { search?: string; reason?: string; year?: string; page?: number; all?: boolean } = {},
) {
  try {
    await requireStaffAny("users");
    // The year as it reads in the Philippines.
    const YEAR = `EXTRACT(YEAR FROM ("endedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')::int`;
    const params: unknown[] = [];
    const param = (value: unknown) => `$${params.push(value)}`;
    const conditions: string[] = [];
    const search = likeText(input.search);
    if (search) {
      const like = param(`%${search}%`);
      conditions.push(`("shopName" ILIKE ${like} OR "ownerName" ILIKE ${like} OR "ownerEmail" ILIKE ${like} OR "unitId" ILIKE ${like})`);
    }
    if (input.reason && input.reason !== "ALL") conditions.push(`"reason" = ${param(String(input.reason))}`);
    if (/^\d{4}$/.test(input.year ?? "")) conditions.push(`${YEAR} = ${param(Number(input.year))}`);
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [[matching], years] = await Promise.all([
      prisma.$queryRawUnsafe<{ total: number; unpaid: number }[]>(
        `SELECT COUNT(*)::int AS "total", COALESCE(SUM("outstanding"), 0)::float AS "unpaid" FROM "TenantHistory" ${where}`,
        ...params,
      ),
      prisma.$queryRawUnsafe<{ year: number; count: number }[]>(
        `SELECT ${YEAR} AS "year", COUNT(*)::int AS "count" FROM "TenantHistory" GROUP BY 1 ORDER BY 1 DESC`,
      ),
    ]);
    const page = clampPage(input.page, matching.total);
    const limit = input.all ? "" : `LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`;
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "TenantHistory" ${where} ORDER BY "endedAt" DESC, "id" DESC ${limit}`,
      ...params,
    );
    return {
      success: true as const,
      data: {
        rows: rows.map((r) => ({
          ...r,
          leaseStart: new Date(r.leaseStart).toISOString(),
          endedAt: new Date(r.endedAt).toISOString(),
          totalPaid: Number(r.totalPaid) || 0,
          outstanding: Number(r.outstanding) || 0,
          avgRating: Number(r.avgRating) || 0,
        })),
        total: matching.total,
        page,
        unpaid: matching.unpaid,
        all: years.reduce((sum, y) => sum + y.count, 0),
        years: years.map((y) => y.year),
      },
    };
  } catch (error: any) {
    console.error("[GET_TENANT_HISTORY_ERROR]:", error);
    return { success: false as const, error: "Failed to load tenant history." };
  }
}

// ─── Tenant: shop settings (Profile Settings → Shop) ─────────────────────────


export async function getMyShopSettingsAction(userId: string) {
  try {
    const account = await requireSelf(userId);
    const tenant = await prisma.tenant.findUnique({ where: { userId } });
    const shop = tenant && (await workspaceShop(account, tenant));
    if (!shop) return { success: false as const, error: "No shop is linked to this account." };
    return {
      success: true as const,
      data: {
        id: shop.id,
        shopName: shop.shopName,
        description: shop.description || "",
        logoUrl: shop.logoUrl || "",
        category: shop.category || "Other",
        phone: shop.phone || "",
        openingHours: shop.openingHours || "",
        unitId: shop.unitId,
        status: shop.status || "ACTIVE",
      },
    };
  } catch (error: any) {
    console.error("[GET_SHOP_SETTINGS_ERROR]:", error);
    return { success: false as const, error: "Couldn't load your shop settings." };
  }
}

export type MyShopSettings = Extract<Awaited<ReturnType<typeof getMyShopSettingsAction>>, { success: true }>["data"];

export async function updateMyShopSettingsAction(
  userId: string,
  data: { shopId?: string; shopName: string; description?: string; category?: string; phone?: string; openingHours?: string },
) {
  try {
    await requireSelf(userId);
    const shopName = (data.shopName || "").trim();
    if (shopName.length < 2 || shopName.length > 80) {
      return { success: false, error: "Shop name must be 2–80 characters." };
    }
    const category = (SHOP_CATEGORIES as readonly string[]).includes(data.category || "") ? data.category! : "Other";
    const phone = (data.phone || "").trim();
    if (phone && !/^[+0-9()\-\s]{7,20}$/.test(phone)) {
      return { success: false, error: "Enter a valid shop phone number." };
    }
    const description = (data.description || "").trim().slice(0, 1000);
    const openingHours = (data.openingHours || "").trim().slice(0, 120);

    const tenant = await prisma.tenant.findUnique({ where: { userId }, select: { id: true } });
    const shop = tenant && (await ownShop(tenant.id, data.shopId || tenant.id));
    if (!shop) return { success: false, error: "No shop is linked to this account." };
    const changes = {
      shopName,
      description: description || null,
      category,
      phone: phone || null,
      openingHours: openingHours || null,
    };
    if (shop.isMain) await prisma.tenant.update({ where: { id: shop.id }, data: changes });
    else await prisma.unitShop.update({ where: { id: shop.id }, data: changes });

    revalidatePath("/tenantdashboard");
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("[UPDATE_SHOP_SETTINGS_ERROR]:", error);
    return { success: false, error: "Couldn't save your shop settings." };
  }
}

/** Upload a shop logo: updates the shop only (not the owner's personal avatar). */
export async function uploadShopLogoAction(userId: string, formData: FormData) {
  try {
    await requireSelf(userId);
    const file = formData.get("file") as File | null;
    if (!file) return { success: false, error: "No file provided." };
    if (!file.type?.startsWith("image/")) return { success: false, error: "Please choose an image file." };
    if (file.size > 5 * 1024 * 1024) return { success: false, error: "Images must be under 5 MB." };

    const { validateImageFile } = await import("@/lib/cloud-storage");
    const check = validateImageFile(file);
    if (!check.valid) return { success: false, error: check.error };
    const { storeFile } = await import("@/lib/upload-server");
    const { url } = await storeFile(file, "tenant-logos");
    const tenant = await prisma.tenant.findUnique({ where: { userId }, select: { id: true } });
    const shop = tenant && (await ownShop(tenant.id, String(formData.get("shopId") || tenant.id)));
    if (!shop) return { success: false, error: "No shop is linked to this account." };
    if (shop.isMain) await prisma.tenant.update({ where: { id: shop.id }, data: { logoUrl: url } });
    else await prisma.unitShop.update({ where: { id: shop.id }, data: { logoUrl: url } });

    revalidatePath("/tenantdashboard");
    revalidatePath("/");
    return { success: true, url };
  } catch (error: any) {
    console.error("[UPLOAD_SHOP_LOGO_ERROR]:", error);
    return { success: false, error: "Couldn't upload the logo." };
  }
}

/**
 * Product page (/products/[shopId]/[productId]): the product, the shop's
 * public profile and more items from the same shop. Hidden products and
 * inactive shops are not shown.
 */
export async function getProductPageAction(shopId: string, productId: string) {
  try {
    const t = await findShop(shopId);
    if (!t || t.status !== "ACTIVE") return { success: false as const, error: "Shop not found" };
    const listed = publicProducts(t.products) as any[];
    const product = listed.find((p) => p.id === productId);
    if (!product) return { success: false as const, error: "Product not found" };

    const extras = await storefrontExtras([t]).then((fn) => fn(t));

    return {
      success: true as const,
      data: {
        product,
        shop: {
          id: t.id,
          name: t.shopName,
          logoUrl: t.logoUrl,
          unitId: t.unitId,
          floor: extras.floor,
          category: t.category,
          isOpen: t.isOpen,
          description: t.description,
          phone: t.phone,
          openingHours: t.openingHours,
          avgRating: extras.avgRating,
          reviewCount: extras.reviewCount,
          productCount: listed.length,
          joinedAt: t.createdAt.toISOString(),
        },
        moreFromShop: listed.filter((p) => p.id !== productId).slice(0, 8),
      },
    };
  } catch (error: any) {
    console.error("[GET_PRODUCT_PAGE_ERROR]:", error);
    return { success: false as const, error: "Couldn't load this product." };
  }
}
