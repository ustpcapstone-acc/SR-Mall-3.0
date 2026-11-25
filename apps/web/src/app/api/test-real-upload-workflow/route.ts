import { NextResponse } from "next/server";
import { prisma } from "@srmall/database";
import { denyUnlessSuperuser } from "@/lib/route-guard";

export async function GET() {
  const denied = await denyUnlessSuperuser();
  if (denied) return denied;

  try {
    console.log("=== TEST: Simulating real upload workflow ===");

    // Get the tenant
    const tenant = await prisma.tenant.findFirst({
      include: { user: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: "No tenant found" }, { status: 404 });
    }

    console.log("Found tenant:", tenant);

    // Create a promo with local upload URL (like real upload)
    const now = new Date();
    const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    const promo = await prisma.tenantPromo.create({
      data: {
        title: "Real Upload Test Video",
        description: "Testing real upload workflow with local URL",
        promoVideo: "/uploads/tenant-promos/test_video_123456.mp4", // Simulating real upload
        category: "Fashion",
        startDate: now,
        endDate: futureDate,
        tenantId: tenant.id,
        mediaType: "VIDEO",
        status: "PENDING", // Start as pending
      } as any, // Type assertion to handle schema differences
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
    });

    console.log("Created pending promo:", promo);

    // Now approve it (simulate admin approval)
    const approvedPromo = await prisma.tenantPromo.update({
      where: { id: promo.id },
      data: { status: "APPROVED" },
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
    });

    console.log("Approved promo:", approvedPromo);

    return NextResponse.json({
      success: true,
      pendingPromo: promo,
      approvedPromo: approvedPromo,
      message: "Real upload workflow simulated!",
    });
  } catch (error) {
    console.error("TEST REAL UPLOAD WORKFLOW ERROR:", error);
    return NextResponse.json(
      { error: "Failed to simulate real upload workflow" },
      { status: 500 },
    );
  }
}
