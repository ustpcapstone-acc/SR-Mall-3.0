import type { Metadata } from "next";
import { prisma } from "@srmall/database";

// The browser tab shows the shop's name (the page itself is a client component).
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const shop = await prisma.tenant.findUnique({ where: { id }, select: { shopName: true, description: true } });
    if (shop?.shopName) {
      return {
        title: `${shop.shopName} | SR Mall`,
        description: shop.description?.slice(0, 160) || `${shop.shopName} at SR Mall.`,
      };
    }
  } catch {
    /* fall back below */
  }
  return { title: "Shop | SR Mall" };
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}
