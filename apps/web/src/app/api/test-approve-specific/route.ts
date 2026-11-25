import { NextResponse } from "next/server";
import { prisma } from "@srmall/database";
import { denyUnlessSuperuser } from "@/lib/route-guard";

export async function POST(request: Request) {
  const denied = await denyUnlessSuperuser();
  if (denied) return denied;

  try {
    console.log("=== TEST: Approving specific tenant promo ===");

    const { promoId } = await request.json();

    if (!promoId) {
      return NextResponse.json({ error: "Promo ID required" }, { status: 400 });
    }

    // Get the specific pending promo
    const pendingPromo = await prisma.tenantPromo.findFirst({
      where: {
        id: promoId,
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

    if (!pendingPromo) {
      return NextResponse.json(
        { error: "Pending promo not found" },
        { status: 404 },
      );
    }

    console.log("Found pending promo to approve:", pendingPromo);

    // Approve the promo
    const approvedPromo = await prisma.tenantPromo.update({
      where: { id: promoId },
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
      promo: approvedPromo,
      message: `Promo "${approvedPromo.title}" has been approved!`,
    });
  } catch (error) {
    console.error("TEST APPROVE SPECIFIC ERROR:", error);
    return NextResponse.json(
      { error: "Failed to approve promo" },
      { status: 500 },
    );
  }
}
