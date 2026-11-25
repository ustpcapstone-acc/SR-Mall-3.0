import type { Metadata } from "next";
import { findShop } from "@/lib/shops";

// The browser tab shows the shop's name (the page itself is a client component).
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const shop = await findShop(id);
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
