"use server";

/**
 * "Inquire" on a product page: sends the customer's question to the shop
 * through the normal chat (so the shop is notified as usual), then posts an
 * automated reply from the shop with the product's current availability,
 * read from the database at that moment.
 */
import { findShop } from "@/lib/shops";
import { requireActingAs } from "@/lib/action-guard";
import { prisma } from "@srmall/database";
import { sendMessage } from "@/app/actions/chat";
import { availabilityLabel, isListed, isOutOfStock, stockCount } from "@/lib/products";

export async function sendProductInquiryAction(userId: string, shopId: string, productId: string) {
  try {
    if (!userId) return { success: false as const, error: "Please sign in to send an inquiry." };
    await requireActingAs(userId);

    const [user, shop] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
      findShop(shopId),
    ]);
    if (!user?.email) return { success: false as const, error: "Please sign in again to send an inquiry." };
    if (!shop || shop.status !== "ACTIVE") return { success: false as const, error: "This shop isn't available right now." };
    if (shop.ownerUserId === userId) return { success: false as const, error: "This is your own shop." };

    const product = (Array.isArray(shop.products) ? (shop.products as any[]) : []).find((p) => p?.id === productId);
    if (!product || !isListed(product)) return { success: false as const, error: "This product is no longer available." };

    const name = String(product.name || "this item").slice(0, 120);
    const price = product.price ? ` (${String(product.price).slice(0, 40)})` : "";

    // 1. The customer's question, through the normal chat flow.
    const sent: any = await sendMessage({
      userId: user.email,
      recipientType: "shop",
      tenantId: shop.id,
      content: `Hi! I'm interested in ${name}${price}. Is it available?`,
    });
    if (!sent?.success) return { success: false as const, error: sent?.error || "Couldn't send the inquiry." };

    // 2. Automated reply from the shop with the live availability.
    const n = stockCount(product);
    const availability = isOutOfStock(product)
      ? `is currently out of stock`
      : n === null
        ? `is in stock`
        : `has ${n} ${n === 1 ? "piece" : "pieces"} available`;
    await prisma.message.create({
      data: {
        conversationId: sent.conversationId,
        senderId: shop.ownerUserId,
        // Reads like a normal reply from the shop (no "automated" label).
        content: `${name.charAt(0).toUpperCase()}${name.slice(1)} ${availability}${
          isOutOfStock(product) ? ". You can ask the shop when it will be restocked." : "."
        } The shop will reply to you here soon.`,
      },
    });
    await prisma.conversation.update({ where: { id: sent.conversationId }, data: { updatedAt: new Date() } }).catch(() => {});

    return { success: true as const, shopName: shop.shopName, availability: availabilityLabel(product) };
  } catch (error) {
    console.error("[PRODUCT_INQUIRY_ERROR]:", error);
    return { success: false as const, error: "Couldn't send the inquiry. Please try again." };
  }
}
