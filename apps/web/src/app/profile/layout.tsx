import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Profile | SR Mall",
  description: "Your SR Mall profile, favourites and notifications.",
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
