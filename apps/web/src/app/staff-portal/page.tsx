import type { Metadata } from "next";
import { PortalLogin } from "@/components/portal-login";

export const metadata: Metadata = { title: "Staff sign-in | SR Mall", robots: { index: false, follow: false } };

export default function StaffPortalPage() {
  return <PortalLogin portal="ADMIN" />;
}
