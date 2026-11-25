import { NextResponse } from "next/server";
import { prisma } from "@srmall/database";
import { denyUnlessSuperuser } from "@/lib/route-guard";

export async function POST(request: Request) {
  const denied = await denyUnlessSuperuser();
  if (denied) return denied;

  try {
    console.log("=== TEST: Approving a tenant promo ===");

    // Get the first pending promo
    const pendingPromo = await prisma.tenantPromo.findFirst({
      where: { status: "PENDING" },
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
        { error: "No pending promo found" },
        { status: 404 },
      );
    }

    console.log("Found pending promo:", pendingPromo);

    // Approve the promo
    const approvedPromo = await prisma.tenantPromo.update({
      where: { id: pendingPromo.id },
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
    console.error("TEST APPROVE PROMO ERROR:", error);
    return NextResponse.json(
      { error: "Failed to approve promo" },
      { status: 500 },
    );
  }
}
