import { NextResponse } from "next/server";
import { prisma } from "@srmall/database";
import { denyUnlessSuperuser } from "@/lib/route-guard";

export async function GET() {
  const denied = await denyUnlessSuperuser();
  if (denied) return denied;

  try {
    console.log(
      "=== TEST: Creating an approved tenant promo with current dates ===",
    );

    // Get the tenant
    const tenant = await prisma.tenant.findFirst({
      include: { user: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: "No tenant found" }, { status: 404 });
    }

    console.log("Found tenant:", tenant);

    // Create an approved promo with current dates
    const now = new Date();
    const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    const promo = await prisma.tenantPromo.create({
      data: {
        title: "Test Approved Summer Sale",
        description: "Amazing approved summer sale with up to 50% off!",
        promoImage:
          "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=2000",
        category: "Fashion",
        startDate: now,
        endDate: futureDate,
        tenantId: tenant.id,
        mediaType: "IMAGE",
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

    console.log("Created approved promo:", promo);

    return NextResponse.json({
      success: true,
      promo: promo,
      tenant: tenant,
      dates: {
        startDate: promo.startDate,
        endDate: promo.endDate,
        now: now,
        futureDate: futureDate,
      },
    });
  } catch (error) {
    console.error("TEST CREATE APPROVED PROMO ERROR:", error);
    return NextResponse.json(
      { error: "Failed to create approved promo" },
      { status: 500 },
    );
  }
}
