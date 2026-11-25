import { NextResponse } from "next/server";
import { getApprovedTenantPromos } from "@/app/actions/ads";
import { denyUnlessSuperuser } from "@/lib/route-guard";

export async function GET() {
  const denied = await denyUnlessSuperuser();
  if (denied) return denied;

  try {
    console.log("=== TEST: Testing getApprovedTenantPromos function ===");

    const promos = await getApprovedTenantPromos();

    console.log("Function returned:", promos.length, "promos");
    console.log("Promo details:", promos);

    return NextResponse.json({
      success: true,
      count: promos.length,
      promos: promos,
    });
  } catch (error) {
    console.error("TEST APPROVED FUNCTION ERROR:", error);
    return NextResponse.json(
      { error: "Failed to test approved promos function" },
      { status: 500 },
    );
  }
}
