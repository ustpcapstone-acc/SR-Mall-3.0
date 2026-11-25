import { NextResponse } from "next/server";
import { prisma } from "@srmall/database";
import { denyUnlessSuperuser } from "@/lib/route-guard";

export async function GET() {
  const denied = await denyUnlessSuperuser();
  if (denied) return denied;

  try {
    console.log("=== TEST: Creating a test tenant promo ===");

    // First, get the tenant
    const tenant = await prisma.tenant.findFirst({
      include: { user: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: "No tenant found" }, { status: 404 });
    }

    console.log("Found tenant:", tenant);

    // Create a test promo
    const promo = await prisma.tenantPromo.create({
      data: {
        title: "Test Summer Sale",
        description: "Amazing summer sale with up to 50% off!",
        promoImage:
          "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=2000",
        category: "Fashion",
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        tenantId: tenant.id,
        mediaType: "IMAGE",
        status: "PENDING",
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

    console.log("Created promo:", promo);

    return NextResponse.json({
      success: true,
      promo: promo,
      tenant: tenant,
    });
  } catch (error) {
    console.error("TEST CREATE PROMO ERROR:", error);
    return NextResponse.json(
      { error: "Failed to create test promo" },
      { status: 500 },
    );
  }
}
