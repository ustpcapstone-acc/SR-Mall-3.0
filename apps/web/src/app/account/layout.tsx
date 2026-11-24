import type { Metadata } from "next";

export const metadata: Metadata = { title: "My Account | SR Mall" };

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
