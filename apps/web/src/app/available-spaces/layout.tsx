import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Available Spaces | SR Mall",
  description: "Commercial units for rent at SR Mall, with floor area, lease terms and how to reserve.",
};

export default function AvailableSpacesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
