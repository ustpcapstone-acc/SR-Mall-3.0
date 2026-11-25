import { NextResponse } from "next/server";
import { getApprovedTenantPromos, getAllMallAds } from "@/app/actions/ads";
import { denyUnlessSuperuser } from "@/lib/route-guard";

export async function GET() {
  const denied = await denyUnlessSuperuser();
  if (denied) return denied;

  try {
    console.log("=== TEST: Checking AdBanner data ===");

    const mallAds = await getAllMallAds();
    const tenantPromos = await getApprovedTenantPromos();

    console.log("Mall Ads:", mallAds.length, "items");
    console.log("Tenant Promos:", tenantPromos.length, "items");

    // Simulate what AdBanner should receive
    const combinedAds = [...mallAds, ...tenantPromos];

    return NextResponse.json({
      success: true,
      mallAds: {
        count: mallAds.length,
        items: mallAds.map((ad: any) => ({
          id: ad.id,
          title: ad.title,
          type: "mall_ad",
        })),
      },
      tenantPromos: {
        count: tenantPromos.length,
        items: tenantPromos.map((promo: any) => ({
          id: promo.id,
          title: promo.title,
          type: "tenant_promo",
          tenant: promo.tenant?.shopName || "Unknown",
        })),
      },
      combinedAds: {
        count: combinedAds.length,
        items: combinedAds.map((ad: any) => ({
          id: ad.id,
          title: ad.title,
          type: "promoImage" in ad ? "tenant_promo" : "mall_ad",
        })),
      },
    });
  } catch (error) {
    console.error("TEST AD BANNER DATA ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch AdBanner data" },
      { status: 500 },
    );
  }
}
