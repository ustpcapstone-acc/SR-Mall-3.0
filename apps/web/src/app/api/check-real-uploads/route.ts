import { NextResponse } from "next/server";
import { prisma } from "@srmall/database";
import { denyUnlessSuperuser } from "@/lib/route-guard";

export async function GET() {
  const denied = await denyUnlessSuperuser();
  if (denied) return denied;

  try {
    console.log("=== CHECK: Real uploaded files vs database ===");

    // Get all tenant promos
    const allPromos = await prisma.tenantPromo.findMany({
      include: {
        tenant: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    console.log("All tenant promos in database:", allPromos.length);

    // Filter promos with actual upload URLs
    const uploadPromos = allPromos.filter(
      (promo) =>
        (promo as any).promoVideo &&
        (promo as any).promoVideo.includes("/uploads/tenant-promos/"),
    );

    console.log("Promos with upload URLs:", uploadPromos.length);

    // Check approved promos with upload URLs
    const approvedUploadPromos = uploadPromos.filter(
      (promo) => promo.status === "APPROVED",
    );

    console.log(
      "Approved promos with upload URLs:",
      approvedUploadPromos.length,
    );

    return NextResponse.json({
      success: true,
      totalPromos: allPromos.length,
      uploadPromosCount: uploadPromos.length,
      approvedUploadPromosCount: approvedUploadPromos.length,
      allPromos: allPromos.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        promoVideo: (p as any).promoVideo,
        promoImage: (p as any).promoImage,
        mediaType: (p as any).mediaType,
        createdAt: p.createdAt,
        tenant: p.tenant?.shopName,
      })),
      uploadPromos: uploadPromos.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        promoVideo: (p as any).promoVideo,
        tenantName: p.tenant?.shopName,
      })),
      approvedUploadPromos: approvedUploadPromos.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        promoVideo: (p as any).promoVideo,
        tenantName: p.tenant?.shopName,
      })),
    });
  } catch (error) {
    console.error("CHECK REAL UPLOADS ERROR:", error);
    return NextResponse.json(
      { error: "Failed to check real uploads" },
      { status: 500 },
    );
  }
}
