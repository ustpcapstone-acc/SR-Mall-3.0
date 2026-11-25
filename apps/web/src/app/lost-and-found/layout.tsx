import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lost and Found | SR Mall",
  description: "Report a lost item, browse items found at SR Mall, or claim one that is yours.",
};

export default function LostAndFoundLayout({ children }: { children: React.ReactNode }) {
  return children;
}
