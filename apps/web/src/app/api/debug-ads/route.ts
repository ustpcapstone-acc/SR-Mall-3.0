import { NextResponse } from "next/server";
import { prisma } from "@srmall/database";
import { denyUnlessSuperuser } from "@/lib/route-guard";

export async function GET() {
  const denied = await denyUnlessSuperuser();
  if (denied) return denied;

  try {
    console.log("🔍 Debug: Testing raw database query...");

    // Test 1: Get all mall ads without filters
    const allAds = await prisma.mallAd.findMany();
    console.log("📊 All ads in database:", allAds.length);

    // Test 2: Get ads with the same filter as getActiveMallAds
    const now = new Date();
    const activeAds = await prisma.mallAd.findMany({
      where: {
        startDate: { lte: now },
        endDate: { gte: now },
        isGlobal: true,
      },
    });
    console.log("📊 Active ads with filters:", activeAds.length);

    // Test 3: Check individual ad details
    allAds.forEach((ad, index) => {
      console.log(`📋 Ad ${index + 1}:`, {
        id: ad.id,
        title: ad.title,
        startDate: ad.startDate,
        endDate: ad.endDate,
        isGlobal: ad.isGlobal,
        isActive: ad.startDate <= now && ad.endDate >= now,
      });
    });

    return NextResponse.json({
      success: true,
      allAds: allAds.length,
      activeAds: activeAds.length,
      ads: allAds,
      activeAdsList: activeAds,
      now: now.toISOString(),
    });
  } catch (error) {
    console.error("❌ Debug error:", error);
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
