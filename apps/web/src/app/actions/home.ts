"use server";

import { getPublicViewConfigAction, getPublicViewCarouselAction } from "./cms";
import { getActiveMallAds, getApprovedTenantPromos } from "./ads";
import { getPublicAreaSlots } from "./space-slot";
import { getAllStorefrontsAction } from "./tenant";

/*
 * Everything the home page needs on first load, in one round trip.
 *
 * Next.js runs a page's server actions one at a time, so six separate reads
 * queued behind each other (about 1 s on the live site). Here they run in
 * parallel on the server. Each read is the same action the page used before,
 * so results (and what visitors are allowed to see) are unchanged.
 */
export async function getHomePageDataAction() {
  const [config, ads, promos, carousel, slots, storefronts] = await Promise.all([
    getPublicViewConfigAction(),
    getActiveMallAds(),
    getApprovedTenantPromos(),
    getPublicViewCarouselAction(),
    getPublicAreaSlots(),
    getAllStorefrontsAction(),
  ]);
  return { config, ads, promos, carousel, slots, storefronts };
}
