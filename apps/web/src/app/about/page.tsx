import type { Metadata } from "next";
import { prisma } from "@srmall/database";
import { getPublicViewConfigAction } from "@/app/actions/cms";
import { AboutView } from "@/components/about-view";
import { aboutSections, readAbout } from "@/lib/about";

export const metadata: Metadata = {
  title: "About Us | SR Mall",
  description: "About SR Mall: the mall, its services, contact details, opening hours and location.",
};

// Read fresh each visit, so changes saved in Website Content show at once.
export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const [config, stored] = await Promise.all([
    getPublicViewConfigAction(),
    prisma.publicViewConfig.findFirst({ orderBy: { createdAt: "desc" }, select: { aboutPage: true } }),
  ]);
  // Hidden and empty sections are removed here, so they never reach the browser.
  return <AboutView config={config} sections={aboutSections(config ?? {}, readAbout(stored?.aboutPage))} />;
}
