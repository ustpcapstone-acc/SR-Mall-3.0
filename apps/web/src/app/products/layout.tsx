import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Products | SR Mall",
  description: "Products from shops at SR Mall, with prices and stock.",
};

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
