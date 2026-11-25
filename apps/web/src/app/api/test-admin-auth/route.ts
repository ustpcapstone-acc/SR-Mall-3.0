import { NextResponse } from "next/server";
import { prisma } from "@srmall/database";
import { denyUnlessSuperuser } from "@/lib/route-guard";

export async function GET() {
  const denied = await denyUnlessSuperuser();
  if (denied) return denied;

  try {
    console.log("=== TEST: Checking admin authentication ===");

    // Get admin user
    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    if (!admin) {
      return NextResponse.json(
        { error: "No admin user found" },
        { status: 404 },
      );
    }

    console.log("Admin user found:", admin);

    // Test getPendingPromos function
    const pendingPromos = await prisma.tenantPromo.findMany({
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
      orderBy: { createdAt: "desc" },
    });

    console.log("Pending promos:", pendingPromos.length, "items");

    return NextResponse.json({
      success: true,
      admin: admin,
      pendingPromos: {
        count: pendingPromos.length,
        items: pendingPromos,
      },
    });
  } catch (error) {
    console.error("TEST ADMIN AUTH ERROR:", error);
    return NextResponse.json(
      { error: "Failed to check admin auth" },
      { status: 500 },
    );
  }
}
