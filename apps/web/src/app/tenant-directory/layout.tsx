import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mall Directory | SR Mall",
  description: "Every shop at SR Mall in Jasaan, Misamis Oriental: what they sell, where to find them, and their promos.",
};

export default function DirectoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
