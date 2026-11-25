import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in | SR Mall",
  description: "Sign in to your SR Mall account.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
