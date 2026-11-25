import { NextResponse } from "next/server";
import { prisma } from "@srmall/database";
import { denyUnlessSuperuser } from "@/lib/route-guard";

export async function GET() {
  const denied = await denyUnlessSuperuser();
  if (denied) return denied;

  try {
    console.log("=== TEST: Creating a video tenant promo ===");

    // Get the tenant
    const tenant = await prisma.tenant.findFirst({
      include: { user: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: "No tenant found" }, { status: 404 });
    }

    console.log("Found tenant:", tenant);

    // Create a video promo with current dates
    const now = new Date();
    const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    const promo = await prisma.tenantPromo.create({
      data: {
        title: "Test Video Promo",
        description: "Amazing video promotion with up to 50% off!",
        promoVideo:
          "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        category: "Fashion",
        startDate: now,
        endDate: futureDate,
        tenantId: tenant.id,
        mediaType: "VIDEO",
        status: "APPROVED",
      },
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

    console.log("Created video promo:", promo);

    return NextResponse.json({
      success: true,
      promo: promo,
      tenant: tenant,
      message: "Video promo created and approved!",
    });
  } catch (error) {
    console.error("TEST CREATE VIDEO PROMO ERROR:", error);
    return NextResponse.json(
      { error: "Failed to create video promo" },
      { status: 500 },
    );
  }
}
