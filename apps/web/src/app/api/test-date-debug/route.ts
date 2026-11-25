import { NextResponse } from "next/server";
import { getApprovedTenantPromos } from "@/app/actions/ads";
import { denyUnlessSuperuser } from "@/lib/route-guard";

export async function GET() {
  const denied = await denyUnlessSuperuser();
  if (denied) return denied;

  try {
    console.log("=== TEST: Date debugging ===");

    const now = new Date();
    console.log("Current date/time:", now.toISOString());

    const promos = await getApprovedTenantPromos();

    console.log("Function returned promos:", promos.length);
    promos.forEach((promo: any, index: number) => {
      console.log(`Promo ${index + 1}:`, {
        id: promo.id,
        title: promo.title,
        startDate: promo.startDate,
        endDate: promo.endDate,
        startValid: new Date(promo.startDate) <= now,
        endValid: new Date(promo.endDate) >= now,
        status: promo.status,
      });
    });

    return NextResponse.json({
      success: true,
      currentDate: now.toISOString(),
      promoCount: promos.length,
      promos: promos.map((p: any) => ({
        id: p.id,
        title: p.title,
        startDate: p.startDate,
        endDate: p.endDate,
        startValid: new Date(p.startDate) <= now,
        endValid: new Date(p.endDate) >= now,
        status: p.status,
      })),
    });
  } catch (error) {
    console.error("TEST DATE DEBUG ERROR:", error);
    return NextResponse.json(
      { error: "Failed to debug dates" },
      { status: 500 },
    );
  }
}
