import { NextResponse } from "next/server";
import { getApprovedTenantPromos, getAllMallAds } from "@/app/actions/ads";
import { denyUnlessSuperuser } from "@/lib/route-guard";

export async function GET() {
  const denied = await denyUnlessSuperuser();
  if (denied) return denied;

  try {
    console.log("=== TEST: Checking public view data ===");

    const mallAds = await getAllMallAds();
    const tenantPromos = await getApprovedTenantPromos();

    console.log("Mall Ads:", mallAds.length, "items");
    console.log("Tenant Promos:", tenantPromos.length, "items");

    return NextResponse.json({
      success: true,
      mallAds: {
        count: mallAds.length,
        items: mallAds,
      },
      tenantPromos: {
        count: tenantPromos.length,
        items: tenantPromos,
      },
      totalAds: mallAds.length + tenantPromos.length,
    });
  } catch (error) {
    console.error("TEST PUBLIC VIEW ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch public view data" },
      { status: 500 },
    );
  }
}
